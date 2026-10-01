import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Button, IconButton, Input, Label, Text, Typography, useTheme } from '@finapp/ui/native';
import { CategoryIcon } from './CategoryIcon';

export type BudgetCategoryOption = { id: string; name: string; icon?: string };
export type BudgetFormScreenProps = {
  mode: 'create' | 'edit';
  name: string;
  amount: string;
  currency: string;
  categoryId: string;
  categories: readonly BudgetCategoryOption[];
  startDate: string;
  endDate: string;
  loading?: boolean;
  pending?: boolean;
  error?: string | null;
  onNameChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onCategoryChange: (id: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function BudgetFormScreen(props: BudgetFormScreenProps) {
  const { tokens } = useTheme();
  const creating = props.mode === 'create';
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 24,
        paddingTop: 16,
        paddingBottom: 40,
        gap: 20,
        flexGrow: 1,
      }}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <IconButton
        label="Back to budgets"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={props.onBack}
      >
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <View style={{ gap: 6 }}>
        <Typography variant="title">{creating ? 'New budget' : 'Edit budget'}</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          Set a category spending limit and review real expenses against it.
        </Text>
      </View>
      <View
        style={{
          gap: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 18,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <Typography variant="bodyLarge">Budget details</Typography>
        {props.loading ? (
          <Text>Loading categories and currency…</Text>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Label>Budget name</Label>
              <Input
                accessibilityLabel="Budget name"
                value={props.name}
                onChangeText={props.onNameChange}
                maxLength={80}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Label>Spending limit ({props.currency})</Label>
              <Input
                accessibilityLabel="Budget spending limit"
                keyboardType="decimal-pad"
                value={props.amount}
                onChangeText={props.onAmountChange}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Label>Category</Label>
              {props.categories.length ? (
                props.categories.map((category) => {
                  const selected = props.categoryId === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => props.onCategoryChange(category.id)}
                      style={{
                        minHeight: 56,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: selected ? tokens.primary : tokens.border,
                        borderRadius: 14,
                      }}
                    >
                      <CategoryIcon
                        label={category.name}
                        icon={category.icon}
                        selected={selected}
                      />
                      <Text>{category.name}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text>No available categories. Create a category first.</Text>
              )}
            </View>
            <View style={{ gap: 10 }}>
              <View style={{ gap: 8 }}>
                <Label>Starts (YYYY-MM-DD, UTC)</Label>
                <Input
                  accessibilityLabel="Budget start date"
                  value={props.startDate}
                  onChangeText={props.onStartDateChange}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Label>Ends (exclusive, YYYY-MM-DD, UTC)</Label>
                <Input
                  accessibilityLabel="Budget end date"
                  value={props.endDate}
                  onChangeText={props.onEndDateChange}
                />
              </View>
            </View>
          </>
        )}
      </View>
      {!!props.error && <Text style={{ color: tokens.destructive }}>{props.error}</Text>}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button
          size="lg"
          disabled={props.loading || props.pending || !props.name.trim() || !props.categoryId}
          onPress={props.onSubmit}
          style={{ flex: 1 }}
        >
          {props.pending ? 'Saving…' : creating ? 'Create budget' : 'Save changes'}
        </Button>
        <Button size="lg" variant="outline" disabled={props.pending} onPress={props.onBack}>
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}
