import React from 'react';
import { View } from 'react-native';
import { Button, Empty, Typography } from '@/components/ui';

export default function CategoriesScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Categories</Typography>
      <Button>New category</Button>
      <Empty
        title="No custom categories"
        description="System categories are ready when you record a transaction."
      />
    </View>
  );
}
