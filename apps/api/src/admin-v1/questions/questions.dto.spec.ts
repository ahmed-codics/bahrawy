import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QuestionInputDto, UpdateQuestionDto } from './questions.dto';

const validPayload = {
  titleAr: 'ما هي عاصمة مصر؟',
  options: [
    { id: '1', textAr: 'القاهرة' },
    { id: '2', textAr: 'الإسكندرية' },
  ],
  correctOptionId: '1',
};

describe('QuestionInputDto', () => {
  async function errors(payload: Record<string, unknown>) {
    const instance = plainToInstance(QuestionInputDto, payload, {
      excludeExtraneousValues: false,
    });
    return validate(instance, {
      whitelist: true,
      validationError: { target: false },
    });
  }

  it('accepts a valid question with textAr-only options', async () => {
    const result = await errors(validPayload);
    expect(result).toHaveLength(0);
  });

  it('accepts text/titleAr/label/value option keys used by other surfaces', async () => {
    const result = await errors({
      ...validPayload,
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', titleAr: 'B' },
        { id: 'c', label: 'C' },
        { id: 'd', value: 'D' },
      ],
      correctOptionId: 'c',
    });
    expect(result).toHaveLength(0);
  });

  it('accepts single-letter opaque ids', async () => {
    const result = await errors({
      ...validPayload,
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'b2', text: 'B2' },
        { id: 'local-390-1', text: 'Local' },
      ],
      correctOptionId: 'b2',
    });
    expect(result).toHaveLength(0);
  });

  it('rejects correctOptionId that references no submitted option', async () => {
    const result = await errors({ ...validPayload, correctOptionId: 'zz' });
    expect(result.length).toBeGreaterThan(0);
    const flat = JSON.stringify(result);
    expect(flat).toContain('validQuestionOptions');
  });

  it('rejects a missing correctOptionId', async () => {
    const { correctOptionId: _removed, ...rest } = validPayload;
    void _removed;
    const result = await errors(rest);
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects duplicate option ids', async () => {
    const result = await errors({
      ...validPayload,
      options: [
        { id: '1', text: 'A' },
        { id: '1', text: 'B' },
      ],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).toContain('validQuestionOptions');
  });

  it('rejects an option without an id', async () => {
    const result = await errors({
      ...validPayload,
      options: [{ id: '1', text: 'A' }, { text: 'B' }],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an option with a non-string id', async () => {
    const result = await errors({
      ...validPayload,
      options: [
        { id: 1, text: 'A' },
        { id: '2', text: 'B' },
      ],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an option with only an id and no text-like field', async () => {
    const result = await errors({
      ...validPayload,
      options: [{ id: '1', text: 'A' }, { id: '2' }],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).toContain('validQuestionOptions');
  });

  it('rejects options that are not objects', async () => {
    const result = await errors({
      ...validPayload,
      options: ['not', 'objects'],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an option that is null', async () => {
    const result = await errors({
      ...validPayload,
      options: [{ id: '1', text: 'A' }, null],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects fewer than two options', async () => {
    const result = await errors({
      ...validPayload,
      options: [{ id: '1', text: 'A' }],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an empty options array', async () => {
    const result = await errors({ ...validPayload, options: [] });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('UpdateQuestionDto', () => {
  async function errors(payload: Record<string, unknown>) {
    const instance = plainToInstance(UpdateQuestionDto, payload, {
      excludeExtraneousValues: false,
    });
    return validate(instance, {
      whitelist: true,
      validationError: { target: false },
    });
  }

  it('accepts a valid update payload', async () => {
    const result = await errors({ ...validPayload, version: 1 });
    expect(result).toHaveLength(0);
  });

  it('rejects the same invalid option shapes as create', async () => {
    const result = await errors({
      ...validPayload,
      options: [
        { id: '1', text: 'A' },
        { id: '1', text: 'B' },
      ],
      correctOptionId: 'x',
      version: 1,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('requires a version', async () => {
    const { version: _removed, ...rest } = { ...validPayload, version: 1 };
    void _removed;
    const result = await errors(rest);
    expect(result.length).toBeGreaterThan(0);
  });
});
