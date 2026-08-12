import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';

describe('PaginationQueryDto', () => {
  async function errors(payload: Record<string, unknown>) {
    const instance = plainToInstance(PaginationQueryDto, payload);
    const result = await validate(instance, {
      whitelist: true,
      validationError: { target: false },
    });
    return { result, instance };
  }

  it('is valid when both values are omitted', async () => {
    const { result } = await errors({});
    expect(result).toHaveLength(0);
  });

  it('transforms numeric strings and accepts valid values', async () => {
    const { result, instance } = await errors({ page: '2', pageSize: '25' });
    expect(instance.page).toBe(2);
    expect(instance.pageSize).toBe(25);
    expect(result).toHaveLength(0);
  });

  it('accepts the maximum allowed page size', async () => {
    const { result, instance } = await errors({ pageSize: '100' });
    expect(instance.pageSize).toBe(100);
    expect(result).toHaveLength(0);
  });

  it('rejects page 0', async () => {
    const { result } = await errors({ page: '0' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects negative page', async () => {
    const { result } = await errors({ page: '-1' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a non-numeric page', async () => {
    const { result } = await errors({ page: 'abc' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a decimal page', async () => {
    const { result } = await errors({ page: '1.5' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects page size 0', async () => {
    const { result } = await errors({ pageSize: '0' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a negative page size', async () => {
    const { result } = await errors({ pageSize: '-5' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a page size above the maximum', async () => {
    const { result } = await errors({ pageSize: '101' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a page size that is a decimal', async () => {
    const { result } = await errors({ pageSize: '5.5' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a non-numeric page size', async () => {
    const { result } = await errors({ pageSize: 'abc' });
    expect(result.length).toBeGreaterThan(0);
  });
});
