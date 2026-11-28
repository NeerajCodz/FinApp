'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { WEBHOOK_EVENT_TYPES } from '@convex/publicApi/webhookEvents';
import { SettingsGroup, SettingsLink, SettingsSwitch } from '@finapp/ui/finance';
import { errorText, ScopeChips, SecretReveal, when } from './shared';
import styles from './developer.module.css';

export function WebhooksSection({ live }: { live: boolean }) {
  const endpoints = useQuery(api.publicApi.webhooks.listMine, live ? {} : 'skip');
  const create = useMutation(api.publicApi.webhooks.create);
  const update = useMutation(api.publicApi.webhooks.update);
  const remove = useMutation(api.publicApi.webhooks.remove);
  const rotate = useMutation(api.publicApi.webhooks.rotateSecret);
  const sendTest = useMutation(api.publicApi.webhooks.sendTest);
  const [creating, setCreating] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [events, setEvents] = React.useState<string[]>(['transaction.created']);
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const endpoint = await create({ url, events });
      setRevealed(endpoint.secret);
      setCreating(false);
      setUrl('');
    } catch (cause) {
      setMessage(errorText(cause, 'Could not add the endpoint'));
    }
  }

  return (
    <SettingsGroup
      span
      title="Webhooks"
      description="FinApp POSTs signed JSON events to your HTTPS endpoint. Failed deliveries are retried with backoff; endpoints are paused after repeated failures."
    >
      {revealed ? (
        <SecretReveal label="Signing secret" value={revealed} onDone={() => setRevealed(null)} />
      ) : null}
      {creating ? (
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            <span>Endpoint URL (public HTTPS)</span>
            <input
              type="url"
              value={url}
              placeholder="https://example.com/finapp/webhooks"
              onChange={(event) => setUrl(event.currentTarget.value)}
              required
            />
          </label>
          <div className={styles.field}>
            <span>Events</span>
            <div className={styles.scopes}>
              {WEBHOOK_EVENT_TYPES.map((type) => (
                <label key={type} className={styles.scope}>
                  <span className={styles.row}>
                    <input
                      type="checkbox"
                      checked={events.includes(type)}
                      onChange={(event) =>
                        setEvents((current) =>
                          event.currentTarget.checked
                            ? [...current, type]
                            : current.filter((value) => value !== type),
                        )
                      }
                    />
                    <code>{type}</code>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className={styles.row}>
            <button type="submit" className={styles.primary} disabled={!events.length}>
              Add endpoint
            </button>
            <button type="button" className={styles.secondary} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.form}>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              disabled={!live}
              onClick={() => setCreating(true)}
            >
              Add endpoint
            </button>
          </div>
        </div>
      )}
      {message ? <p className={styles.message}>{message}</p> : null}
      {endpoints === undefined ? (
        <SettingsLink title={live ? 'Loading…' : 'Connect to the internet to manage webhooks'} />
      ) : endpoints.length ? (
        endpoints.map((endpoint) => (
          <div key={endpoint.id} className={styles.item}>
            <div className={styles.itemHead}>
              <strong>{endpoint.url}</strong>
              <span className={styles.status} data-tone={endpoint.enabled ? 'positive' : 'danger'}>
                {endpoint.enabled
                  ? 'Enabled'
                  : endpoint.disabledReason === 'too_many_failures'
                    ? 'Paused after failures'
                    : endpoint.disabledReason === 'endpoint_gone'
                      ? 'Paused (410 Gone)'
                      : 'Disabled'}
              </span>
            </div>
            <p className={styles.meta}>
              Secret <code>{endpoint.secretPrefix}…</code>
              {endpoint.appName ? ` · created by ${endpoint.appName}` : ''} · added{' '}
              {when(endpoint.createdAt)}
              {endpoint.consecutiveFailures
                ? ` · ${endpoint.consecutiveFailures} failed deliveries in a row`
                : ''}
            </p>
            <ScopeChips scopes={endpoint.events} />
            <SettingsSwitch
              title="Deliver events"
              description="Turning it back on resets the failure count."
              checked={endpoint.enabled}
              onChange={(enabled) => void update({ endpointId: endpoint.id, enabled })}
            />
            <div className={styles.row}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => void sendTest({ endpointId: endpoint.id })}
              >
                Send test event
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Rotate the signing secret? The old secret keeps working for 24 hours.',
                    )
                  )
                    return;
                  try {
                    setRevealed((await rotate({ endpointId: endpoint.id })).secret);
                  } catch (cause) {
                    setMessage(errorText(cause, 'Could not rotate the secret'));
                  }
                }}
              >
                Rotate secret
              </button>
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  if (window.confirm('Delete this endpoint?'))
                    void remove({ endpointId: endpoint.id });
                }}
              >
                Delete
              </button>
            </div>
            {endpoint.deliveries.length ? (
              <details>
                <summary className={styles.meta}>Recent deliveries</summary>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Attempt</th>
                        <th>Result</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.deliveries.map((delivery) => (
                        <tr key={delivery.id}>
                          <td>
                            <code>{delivery.eventType}</code>
                          </td>
                          <td>{delivery.attempt}</td>
                          <td>
                            {delivery.status}
                            {delivery.responseStatus ? ` · HTTP ${delivery.responseStatus}` : ''}
                            {delivery.errorCode ? ` · ${delivery.errorCode}` : ''}
                            {delivery.durationMs !== undefined
                              ? ` · ${delivery.durationMs} ms`
                              : ''}
                          </td>
                          <td>{when(delivery.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ) : null}
          </div>
        ))
      ) : (
        <SettingsLink title="No webhook endpoints" />
      )}
    </SettingsGroup>
  );
}
