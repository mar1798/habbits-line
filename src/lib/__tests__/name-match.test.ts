import { isNameTaken, isNameTakenByAnother, normalizeName } from '../name-match';

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Пить  воду ')).toBe('пить воду');
  });

  it('lowercases Cyrillic, not just ASCII', () => {
    expect(normalizeName('ЕДА')).toBe('еда');
    expect(normalizeName('Coffee')).toBe('coffee');
  });
});

describe('isNameTaken', () => {
  const taken = ['еда', 'пить воду'];

  it('matches regardless of case and padding', () => {
    expect(isNameTaken('Еда', taken)).toBe(true);
    expect(isNameTaken('  пить   ВОДУ  ', taken)).toBe(true);
  });

  it('lets a new name through', () => {
    expect(isNameTaken('Кофе', taken)).toBe(false);
  });

  it('does not treat an empty name as taken — that is the required-name error, not this one', () => {
    expect(isNameTaken('   ', [''])).toBe(false);
  });
});

describe('isNameTakenByAnother', () => {
  // "Зал" already exists twice — an older build wrote the pair, or an import brought it.
  // Editing either one must not demand a rename first.
  const taken = ['зал', 'пить воду'];

  it('lets a row keep the name it opened with, even when another row has it', () => {
    expect(isNameTakenByAnother('Зал', taken, 'Зал')).toBe(false);
  });

  it('still counts the name as unchanged when only its spacing moved', () => {
    expect(isNameTakenByAnother('  Зал  ', taken, 'Зал')).toBe(false);
  });

  it('blocks a rename onto somebody else’s name', () => {
    expect(isNameTakenByAnother('Пить воду', taken, 'Зал')).toBe(true);
  });

  // Renaming away and back must not be a way around the check: once the form's own name
  // is no longer the colliding one, the collision is a real one again.
  it('blocks renaming back onto a name after moving off it', () => {
    expect(isNameTakenByAnother('Зал', taken, 'Спорт')).toBe(true);
  });

  it('leaves a genuinely new name alone', () => {
    expect(isNameTakenByAnother('Плавание', taken, 'Спорт')).toBe(false);
  });

  // A new-row form opens on an empty name, so the exemption can never fire for it and
  // every duplicate is caught the way it was before.
  it('never exempts a form that opened empty', () => {
    expect(isNameTakenByAnother('Зал', taken, '')).toBe(true);
  });
});
