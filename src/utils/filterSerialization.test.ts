import { serializeFilters, deserializeFilters } from './filterSerialization';
import { PredicateFilter, SetFilter } from '../types/filter';
import { DataColumn } from '../types/dataset';
import { getApplicablePredicates } from '../filters';

// Mock getApplicablePredicates to avoid complex dependencies
jest.mock('../filters', () => ({
    getApplicablePredicates: jest.fn(),
}));

describe('filterSerialization', () => {
    const mockColumn: DataColumn = {
        key: 'test_col',
        name: 'Test Column',
        type: { kind: 'float', optional: false, binary: false, lazy: false },
        index: 0,
        editable: false,
        optional: false,
        computed: false,
        hidden: false,
        description: '',
        tags: [],
    };

    const mockColumnsByKey: Record<string, DataColumn> = {
        test_col: mockColumn,
    };

    const mockPredicate = {
        shorthand: '>',
        compare: (val: number, ref: number) => val > ref,
    };

    beforeEach(() => {
        (getApplicablePredicates as jest.Mock).mockReturnValue({
            greater: mockPredicate,
        });
    });

    it('should serialize and deserialize SetFilter', () => {
        const filter = new SetFilter([1, 2, 3], 'My Set Filter');
        filter.isEnabled = false; // Test non-default value
        const serialized = serializeFilters([filter]);

        expect(serialized).toHaveLength(1);
        expect(serialized[0]).toEqual({
            kind: 'SetFilter',
            rowIndices: [1, 2, 3],
            name: 'My Set Filter',
            isEnabled: false,
        });

        const deserialized = deserializeFilters(serialized, mockColumnsByKey);
        expect(deserialized).toHaveLength(1);
        expect(deserialized[0]).toBeInstanceOf(SetFilter);
        expect((deserialized[0] as SetFilter).rowIndices).toEqual(new Set([1, 2, 3]));
        expect((deserialized[0] as SetFilter).name).toBe('My Set Filter');
        expect(deserialized[0].isEnabled).toBe(false);
    });

    it('should serialize and deserialize PredicateFilter', () => {
        const filter = new PredicateFilter(mockColumn, mockPredicate, 10);
        filter.isEnabled = false; // Test non-default value
        const serialized = serializeFilters([filter]);

        expect(serialized).toHaveLength(1);
        expect(serialized[0]).toEqual({
            kind: 'PredicateFilter',
            columnKey: 'test_col',
            predicate: '>',
            referenceValue: 10,
            isEnabled: false,
        });

        const deserialized = deserializeFilters(serialized, mockColumnsByKey);
        expect(deserialized).toHaveLength(1);
        expect(deserialized[0]).toBeInstanceOf(PredicateFilter);
        expect((deserialized[0] as PredicateFilter).column).toBe(mockColumn);
        expect((deserialized[0] as PredicateFilter).predicate).toBe(mockPredicate);
        expect((deserialized[0] as PredicateFilter).referenceValue).toBe(10);
        expect(deserialized[0].isEnabled).toBe(false);
    });

    it('should skip PredicateFilter if column is missing', () => {
        const serialized = [
            {
                kind: 'PredicateFilter',
                columnKey: 'missing_col',
                predicate: '>',
                referenceValue: 10,
                isEnabled: true,
            } as const,
        ];

        const deserialized = deserializeFilters(serialized, mockColumnsByKey);
        expect(deserialized).toHaveLength(0);
    });

    it('should skip PredicateFilter if predicate is not found', () => {
        (getApplicablePredicates as jest.Mock).mockReturnValue({}); // Return no predicates

        const serialized = [
            {
                kind: 'PredicateFilter',
                columnKey: 'test_col',
                predicate: '>',
                referenceValue: 10,
                isEnabled: true,
            } as const,
        ];

        const deserialized = deserializeFilters(serialized, mockColumnsByKey);
        expect(deserialized).toHaveLength(0);
    });
});
