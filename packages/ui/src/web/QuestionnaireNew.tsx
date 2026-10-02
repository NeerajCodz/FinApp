'use client';

import React from 'react';
import { CustomSelect } from './choices';

export type QuestionnaireField =
  | { name: string; label: string; type: 'text'; required?: boolean; placeholder?: string }
  | {
      name: string;
      label: string;
      type: 'choice';
      required?: boolean;
      options: readonly { label: string; value: string }[];
    }
  | { name: string; label: string; type: 'boolean'; required?: boolean };
export type QuestionnaireAnswers = Record<string, string | boolean | undefined>;
export type QuestionnaireNewProps = {
  fields: readonly QuestionnaireField[];
  answers: QuestionnaireAnswers;
  onAnswersChange: (answers: QuestionnaireAnswers) => void;
  onSubmit: (answers: QuestionnaireAnswers) => void;
  submitLabel?: string;
  accessibilityLabel?: string;
  className?: string;
};

export function QuestionnaireNew({
  fields,
  answers,
  onAnswersChange,
  onSubmit,
  submitLabel = 'Submit',
  accessibilityLabel = 'Questionnaire',
  className,
}: QuestionnaireNewProps) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const update = (name: string, value: string | boolean) => {
    const next = { ...answers, [name]: value };
    onAnswersChange(next);
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    for (const field of fields) {
      const value = answers[field.name];
      if (
        field.required &&
        (value === undefined ||
          (typeof value === 'string' && value.trim() === '') ||
          value === false)
      )
        next[field.name] = 'This field is required.';
    }
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit(answers);
  };
  const inputStyle: React.CSSProperties = {
    boxSizing: 'border-box',
    width: '100%',
    minHeight: 44,
    padding: '10px 12px',
    color: 'var(--finapp-foreground)',
    background: 'var(--finapp-input)',
    border: '1px solid var(--finapp-border)',
    borderRadius: 10,
    font: 'inherit',
  };
  return (
    <form
      onSubmit={submit}
      aria-label={accessibilityLabel}
      noValidate
      className={className}
      style={{ display: 'grid', gap: 18, color: 'var(--finapp-foreground)' }}
    >
      {fields.map((field) => {
        const id = `questionnaire-${field.name}`;
        const errorId = `${id}-error`;
        const error = errors[field.name];
        const common = {
          id,
          'aria-invalid': Boolean(error) as boolean,
          'aria-describedby': error ? errorId : undefined,
        };
        return (
          <div key={field.name} style={{ display: 'grid', gap: 7 }}>
            {field.type === 'boolean' ? (
              <label
                htmlFor={id}
                style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600 }}
              >
                <input
                  {...common}
                  type="checkbox"
                  checked={answers[field.name] === true}
                  onChange={(event) => update(field.name, event.currentTarget.checked)}
                />
                {field.label}
                {field.required && <span aria-hidden="true">*</span>}
              </label>
            ) : (
              <label htmlFor={id} style={{ fontWeight: 600 }}>
                {field.label}
                {field.required && <span aria-hidden="true"> *</span>}
              </label>
            )}
            {field.type === 'text' && (
              <input
                {...common}
                type="text"
                value={
                  typeof answers[field.name] === 'string' ? (answers[field.name] as string) : ''
                }
                placeholder={field.placeholder}
                onChange={(event) => update(field.name, event.currentTarget.value)}
                style={inputStyle}
              />
            )}
            {field.type === 'choice' && (
              <CustomSelect
                {...common}
                value={
                  typeof answers[field.name] === 'string' ? (answers[field.name] as string) : ''
                }
                onChange={(event) => update(field.name, event.currentTarget.value)}
                style={inputStyle}
              >
                <option value="">Choose an option</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            )}
            {error && (
              <span
                id={errorId}
                role="alert"
                style={{ color: 'var(--finapp-danger, #ff6b6b)', fontSize: 13 }}
              >
                {error}
              </span>
            )}
          </div>
        );
      })}
      <button
        type="submit"
        style={{
          minHeight: 44,
          padding: '10px 16px',
          border: 0,
          borderRadius: 10,
          background: 'var(--finapp-primary)',
          color: 'var(--finapp-primary-foreground)',
          font: 'inherit',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {submitLabel}
      </button>
    </form>
  );
}
