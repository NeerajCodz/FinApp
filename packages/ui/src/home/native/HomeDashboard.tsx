import React from 'react';
import { View } from 'react-native';
import { HomeFlowLimits } from './HomeFlowLimits';
import { HomeGoalsCategories } from './HomeGoalsCategories';
import { HomeGroupsBills } from './HomeGroupsBills';
import { HomeHeader } from './HomeHeader';
import { HomeMetrics } from './HomeMetrics';
import { HomePeople } from './HomePeople';
import { HomeRecent } from './HomeRecent';
import type { HomeDashboardProps } from '../types';

export function HomeDashboard(props: HomeDashboardProps) {
  return (
    <View style={{ gap: 22 }}>
      <HomeHeader {...props} />
      <HomeMetrics data={props.data} currency={props.currency} />
      <HomeFlowLimits
        data={props.data}
        currency={props.currency}
        onOpenCategory={props.onOpenCategory}
        onSeeAllCategories={props.onSeeAllCategories}
      />
      <HomePeople
        people={props.people}
        loading={props.peopleLoading}
        currency={props.currency}
        error={props.peopleError}
        onOpenPerson={props.onOpenPerson}
      />
      <HomeRecent
        data={props.data}
        onOpenTransaction={props.onOpenTransaction}
        onSeeAll={props.onSeeAllTransactions}
      />
      <HomeGroupsBills
        data={props.data}
        currency={props.currency}
        onOpenGroup={props.onOpenGroup}
        onSeeAllGroups={props.onSeeAllGroups}
        onSeeAllBills={props.onSeeAllBills}
      />
      <HomeGoalsCategories
        data={props.data}
        currency={props.currency}
        onOpenGoal={props.onOpenGoal}
        onSeeAllGoals={props.onSeeAllGoals}
        onOpenCategory={props.onOpenCategory}
        onSeeAllCategories={props.onSeeAllCategories}
      />
    </View>
  );
}
