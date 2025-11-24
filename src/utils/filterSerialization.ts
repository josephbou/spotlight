import { Filter, PredicateFilter, SetFilter } from '../types/filter';
import { DataColumn } from '../types/dataset';
import { getApplicablePredicates } from '../filters';

export type SerializedFilter =
    | {
          kind: 'PredicateFilter';
          columnKey: string;
          predicate: string;
          referenceValue: unknown;
          isEnabled: boolean;
      }
    | {
          kind: 'SetFilter';
          rowIndices: number[];
          name: string;
          isEnabled: boolean;
      };

export const serializeFilters = (filters: Filter[]): SerializedFilter[] => {
    return filters.map((filter) => {
        if (filter instanceof PredicateFilter) {
            return {
                kind: 'PredicateFilter',
                columnKey: filter.column.key,
                predicate: filter.predicate.shorthand,
                referenceValue: filter.referenceValue,
                isEnabled: filter.isEnabled,
            };
        } else if (filter instanceof SetFilter) {
            return {
                kind: 'SetFilter',
                rowIndices: Array.from(filter.rowIndices),
                name: filter.name,
                isEnabled: filter.isEnabled,
            };
        }
        throw new Error(`Unknown filter kind: ${filter.kind}`);
    });
};

export const deserializeFilters = (
    serializedFilters: SerializedFilter[],
    columnsByKey: Record<string, DataColumn>
): Filter[] => {
    const potentialFilters: (Filter | null)[] = serializedFilters.map(
        (serializedFilter) => {
            if (serializedFilter.kind === 'PredicateFilter') {
                const column = columnsByKey[serializedFilter.columnKey];
                if (!column) {
                    console.warn(
                        `Column ${serializedFilter.columnKey} not found. Skipping filter.`
                    );
                    return null;
                }

                const predicates = getApplicablePredicates(column.type.kind);
                const predicate = Object.values(predicates).find(
                    (p) => p.shorthand === serializedFilter.predicate
                );

                if (!predicate) {
                    console.warn(
                        `Predicate ${serializedFilter.predicate} not found for column type ${column.type.kind}. Skipping filter.`
                    );
                    return null;
                }

                const filter = new PredicateFilter(
                    column,
                    predicate,
                    serializedFilter.referenceValue
                );
                filter.isEnabled = serializedFilter.isEnabled;
                return filter;
            } else if (serializedFilter.kind === 'SetFilter') {
                const filter = new SetFilter(
                    serializedFilter.rowIndices,
                    serializedFilter.name
                );
                filter.isEnabled = serializedFilter.isEnabled;
                return filter;
            }
            return null;
        }
    );
    return potentialFilters.filter((f): f is Filter => f !== null);
};
