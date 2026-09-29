import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type ButtonGroupOrientation = 'horizontal' | 'vertical';

export type ButtonGroupProps = {
  children: React.ReactNode;
  label: string;
  orientation?: ButtonGroupOrientation;
  style?: StyleProp<ViewStyle>;
};

type StyledChildProps = { style?: StyleProp<ViewStyle> };

export function ButtonGroup({
  children,
  label,
  orientation = 'horizontal',
  style,
}: ButtonGroupProps) {
  const { tokens } = useTheme();
  const items = React.Children.toArray(children);
  const horizontal = orientation === 'horizontal';
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.group,
        { flexDirection: horizontal ? 'row' : 'column', borderColor: tokens.border },
        style,
      ]}
    >
      {items.map((child, index) => {
        if (!React.isValidElement<StyledChildProps>(child))
          return <React.Fragment key={index}>{child}</React.Fragment>;
        const first = index === 0;
        const last = index === items.length - 1;
        const borderRadius = horizontal
          ? {
              borderTopLeftRadius: first ? 12 : 0,
              borderBottomLeftRadius: first ? 12 : 0,
              borderTopRightRadius: last ? 12 : 0,
              borderBottomRightRadius: last ? 12 : 0,
            }
          : {
              borderTopLeftRadius: first ? 12 : 0,
              borderTopRightRadius: first ? 12 : 0,
              borderBottomLeftRadius: last ? 12 : 0,
              borderBottomRightRadius: last ? 12 : 0,
            };
        const overlap = index > 0 ? (horizontal ? { marginLeft: -1 } : { marginTop: -1 }) : null;
        return React.cloneElement(child, {
          key: child.key ?? index,
          style: [child.props.style, borderRadius, overlap, { borderColor: tokens.border }],
        });
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
});
