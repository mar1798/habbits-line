import {
  clampFontScale,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  scaleTypography,
  typography,
} from '@/constants/design-tokens';

describe('clampFontScale', () => {
  it('keeps a scale inside the range', () => {
    expect(clampFontScale(1.118)).toBe(1.118);
    expect(clampFontScale(MAX_FONT_SCALE)).toBe(MAX_FONT_SCALE);
  });

  it('never shrinks below the design sizes', () => {
    // iOS's smaller content sizes report 0.823–0.941.
    expect(clampFontScale(0.823)).toBe(MIN_FONT_SCALE);
  });

  it('caps the accessibility sizes', () => {
    // The five accessibility sizes run from 1.786 up to ~3.1.
    expect(clampFontScale(3.1)).toBe(MAX_FONT_SCALE);
  });

  it('falls back to 1 on a missing multiplier', () => {
    expect(clampFontScale(Number.NaN)).toBe(MIN_FONT_SCALE);
  });
});

describe('scaleTypography', () => {
  it('leaves the tokens untouched at 1', () => {
    for (const variant of Object.keys(typography) as (keyof typeof typography)[]) {
      expect(scaleTypography(variant, 1)).toEqual({
        fontSize: typography[variant].fontSize,
        lineHeight: typography[variant].lineHeight,
      });
    }
  });

  it('moves the line height with the font size', () => {
    // 16/22 body at the ceiling: both scaled, so a wrapped line still has its room.
    expect(scaleTypography('body', MAX_FONT_SCALE)).toEqual({ fontSize: 21, lineHeight: 29 });
  });

  it('hands back the same object for the same variant and scale', () => {
    expect(scaleTypography('caption', 1.2)).toBe(scaleTypography('caption', 1.2));
  });
});
