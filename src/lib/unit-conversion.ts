export const UNIT_PAIRS = [
  { id: 'temperature', label: '温度', from: '°F 华氏度', to: '°C 摄氏度', symbolFrom: '°F', symbolTo: '°C', example: '72', factor: 5 / 9, offset: -32 * 5 / 9 },
  { id: 'distance', label: '距离', from: 'mi 英里', to: 'km 公里', symbolFrom: 'mi', symbolTo: 'km', example: '10', factor: 1.609344, offset: 0 },
  { id: 'area', label: '面积', from: 'ft² 平方英尺', to: 'm² 平方米', symbolFrom: 'ft²', symbolTo: 'm²', example: '800', factor: 0.09290304, offset: 0 },
  { id: 'weight', label: '重量', from: 'lb 磅', to: 'kg 千克', symbolFrom: 'lb', symbolTo: 'kg', example: '10', factor: 0.45359237, offset: 0 },
  { id: 'volume', label: '容量', from: 'US gal 美制液体加仑', to: 'L 升', symbolFrom: 'US gal', symbolTo: 'L', example: '1', factor: 3.785411784, offset: 0 },
] as const;
export type UnitKind = typeof UNIT_PAIRS[number]['id'];
export function convertUnit(value: number, kind: UnitKind, reversed = false): number {
  const pair = UNIT_PAIRS.find(item => item.id === kind);
  if (!pair || !Number.isFinite(value) || Math.abs(value) > 1e9) throw new Error('请输入范围内的有效数字。');
  if (kind !== 'temperature' && value < 0) throw new Error('此项请输入零或正数。');
  if (kind === 'temperature' && value < (reversed ? -273.15 : -459.67)) throw new Error('温度不能低于绝对零度。');
  const result = reversed ? (value - pair.offset) / pair.factor : value * pair.factor + pair.offset;
  return Math.abs(result) < 1e-10 ? 0 : result;
}
