import type { Metadata } from 'next';
import Link from 'next/link';
import { apiReference, API_BASE_PATH, API_REVISION, samples, type Field } from '@/lib/api';
import { codeTabs, plainBlock } from '@/lib/markdown';
import { DocEnhancer } from '@/components/DocEnhancer';
import { Toc } from '@/components/Toc';

export const metadata: Metadata = {
  title: 'API reference',
  description: 'Every FinApp REST API v1 endpoint with parameters, schemas and examples.',
};

function FieldTable({ fields, caption }: { fields: Field[]; caption: string }) {
  if (!fields.length) return null;
  const rows = (items: Field[], prefix = ''): React.ReactNode[] =>
    items.flatMap((field) => [
      <tr key={`${prefix}${field.name}`}>
        <td>
          <code>
            {prefix}
            {field.name}
          </code>
          {field.required ? <span className="required">required</span> : null}
        </td>
        <td>
          <code className="type">{field.type}</code>
        </td>
        <td>
          {field.description}
          {field.constraints.length ? (
            <small className="constraints">{field.constraints.join(' · ')}</small>
          ) : null}
        </td>
      </tr>,
      ...(field.children ? rows(field.children, `${prefix}${field.name}.`) : []),
    ]);
  return (
    <div className="table-wrap">
      <table className="fields">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>{rows(fields)}</tbody>
      </table>
    </div>
  );
}

export default async function ApiReferencePage() {
  const tags = apiReference();
  const rendered = await Promise.all(
    tags.map(async (tag) => ({
      ...tag,
      endpoints: await Promise.all(
        tag.endpoints.map(async (endpoint) => ({
          ...endpoint,
          samplesHtml: codeTabs(samples(endpoint)),
          responseHtml: plainBlock(
            JSON.stringify(endpoint.responseExample, null, 2),
            'json',
            `${endpoint.status} response`,
          ),
        })),
      ),
    })),
  );
  const toc = tags.flatMap((tag) => [
    { id: `tag-${tag.name.toLowerCase()}`, text: tag.name, depth: 2 as const },
  ]);
  return (
    <div className="doc-layout">
      <article className="doc reference">
        <p className="eyebrow">Developers</p>
        <h1>API reference</h1>
        <p className="lede">
          REST API {API_BASE_PATH} (revision {API_REVISION}). Generated from the route registry that
          also serves <code>{API_BASE_PATH}/openapi.json</code>; download the{' '}
          <a href="/openapi.json">OpenAPI 3.1 document</a>. Start with the{' '}
          <Link href="/developers/overview">overview</Link> and{' '}
          <Link href="/developers/authentication">authentication</Link>.
        </p>
        {rendered.map((tag) => (
          <section key={tag.name} className="tag-section">
            <h2 id={`tag-${tag.name.toLowerCase()}`}>{tag.name}</h2>
            <p>{tag.description}</p>
            {tag.endpoints.map((endpoint) => (
              <section key={endpoint.id} id={endpoint.id} className="endpoint">
                <h3>
                  <span className={`method method-${endpoint.method.toLowerCase()}`}>
                    {endpoint.method}
                  </span>
                  <code className="endpoint-path">
                    {API_BASE_PATH}
                    {endpoint.path === '/' ? '' : endpoint.path}
                  </code>
                </h3>
                <p className="endpoint-summary">
                  <strong>{endpoint.summary}.</strong> {endpoint.description}
                </p>
                <p className="endpoint-meta">
                  {endpoint.scope ? (
                    <>
                      Scope <code>{endpoint.scope}</code>
                    </>
                  ) : (
                    'No authentication'
                  )}
                  {endpoint.list ? ' · paginated (limit, cursor)' : ''}
                  {endpoint.idempotent ? ' · supports Idempotency-Key' : ''}
                </p>
                <FieldTable fields={endpoint.pathParams} caption="Path parameters" />
                <FieldTable fields={endpoint.queryParams} caption="Query parameters" />
                {endpoint.body ? (
                  <FieldTable fields={endpoint.body} caption="Request body (application/json)" />
                ) : null}
                <div dangerouslySetInnerHTML={{ __html: endpoint.samplesHtml }} />
                <FieldTable
                  fields={endpoint.response}
                  caption={endpoint.list ? 'Response: each item in data[]' : 'Response: data'}
                />
                <div dangerouslySetInnerHTML={{ __html: endpoint.responseHtml }} />
              </section>
            ))}
          </section>
        ))}
        <DocEnhancer />
      </article>
      <Toc entries={toc} />
    </div>
  );
}
