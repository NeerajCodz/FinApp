import React from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

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
  style?: StyleProp<ViewStyle>;
};

export function QuestionnaireNew({
  fields,
  answers,
  onAnswersChange,
  onSubmit,
  submitLabel = 'Submit',
  accessibilityLabel = 'Questionnaire',
  style,
}: QuestionnaireNewProps) {
  const { tokens } = useTheme();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const update = (name: string, value: string | boolean) => {
    const next = { ...answers, [name]: value };
    onAnswersChange(next);
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
  };
  const submit = () => {
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
  const labelStyle = { color: tokens.foreground, fontSize: 15, fontWeight: '600' as const };
  const controlStyle = {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tokens.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center' as const,
    backgroundColor: tokens.input,
  };
  return (
    <View accessibilityLabel={accessibilityLabel} style={[{ gap: 18 }, style]}>
      {fields.map((field) => {
        const error = errors[field.name];
        const value = answers[field.name];
        return (
          <View key={field.name} style={{ gap: 8 }}>
            {field.type !== 'boolean' && (
              <Text style={labelStyle}>
                {field.label}
                {field.required ? ' *' : ''}
              </Text>
            )}
            {field.type === 'text' && (
              <TextInput
                accessibilityLabel={field.label}
                accessibilityHint={error}
                value={typeof value === 'string' ? value : ''}
                placeholder={field.placeholder}
                placeholderTextColor={tokens.foregroundSubtle}
                onChangeText={(text) => update(field.name, text)}
                style={[controlStyle, { color: tokens.foreground }]}
              />
            )}
            {field.type === 'choice' && (
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={field.label}
                style={{ gap: 8 }}
              >
                {field.options.map((option) => {
                  const selected = value === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{ checked: selected }}
                      onPress={() => update(field.name, option.value)}
                      style={[
                        controlStyle,
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          borderColor: selected ? tokens.accent : tokens.borderSubtle,
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: selected ? tokens.accent : tokens.foregroundSubtle,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selected && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: tokens.accent,
                            }}
                          />
                        )}
                      </View>
                      <Text style={{ color: tokens.foreground }}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {field.type === 'boolean' && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={field.label}
                accessibilityState={{ checked: value === true }}
                onPress={() => update(field.name, value !== true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderWidth: 1,
                    borderColor: value === true ? tokens.accent : tokens.borderSubtle,
                    borderRadius: 6,
                    backgroundColor: value === true ? tokens.accent : tokens.input,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {value === true && (
                    <Text style={{ color: tokens.accentForeground, fontWeight: '700' }}>✓</Text>
                  )}
                </View>
                <Text style={labelStyle}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Text>
              </Pressable>
            )}
            {error && (
              <Text accessibilityRole="alert" style={{ color: tokens.destructive, fontSize: 13 }}>
                {error}
              </Text>
            )}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={submit}
        style={{
          minHeight: 48,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 16,
          backgroundColor: tokens.accent,
        }}
      >
        <Text style={{ color: tokens.accentForeground, fontWeight: '700', fontSize: 15 }}>
          {submitLabel}
        </Text>
      </Pressable>
    </View>
  );
}
