import { action, observable } from 'mobx';
import { Primitive, z } from 'zod';

import {
    getCurrentValue,
    getValidValue,
    isValidationError,
    setApproved,
    setCurrentValue,
    ValidationError,
    zodToValidationError,
} from './domain';
import { reportApprovalStatus } from './validation';

const informalDefined = Symbol('@informal/defined');
export type ZodNotEmpty = z.ZodTypeAny & { [informalDefined]: unknown };
export type Value<Z extends z.ZodTypeAny> = Z extends ZodNotEmpty
    ? z.input<Z>
    : z.input<Z> | undefined;

export type Input<Z extends z.ZodTypeAny> = {
    value: Value<Z>;
    approved: boolean;
    [setApproved]: (value: boolean) => void;
    [getCurrentValue]: () => Value<Z>;
    [setCurrentValue]: (value: Value<Z>) => void;
    [getValidValue]: () => z.infer<Z> | ValidationError;
};

export const notEmpty = <
    Schema extends z.ZodTypeAny,
    Value extends z.input<Schema>
>(
    schema: Schema,
    initialValue: Value
): Schema & { [informalDefined]: Value } => {
    const changed = schema as unknown as Schema & { [informalDefined]: Value };
    changed[informalDefined] = initialValue;
    return changed;
};

export const validateAgainstZod = <Schema extends z.ZodTypeAny>(
    schema: Schema,
    value: unknown,
    approval: boolean
): ValidationError | z.infer<Schema> => {
    reportApprovalStatus(approval);
    const result = schema.safeParse(value);
    if (result.success) {
        return result.data;
    }

    return zodToValidationError(result.error, false);
};

export const input = <Schema extends z.ZodTypeAny>(
    schema: Schema
): Input<Schema> => {
    const initialValue: Value<Schema> =
        informalDefined in schema
            ? (schema[informalDefined] as unknown as Value<Schema>)
            : (undefined as unknown as Value<Schema>);

    const store: Input<Schema> = observable({
        value: initialValue,
        approved: false,
        [setApproved]: action((value: boolean) => {
            store.approved = value;
        }),
        [getCurrentValue]: () => {
            reportApprovalStatus(store.approved);
            return store.value;
        },
        [setCurrentValue]: action((value: Value<Schema>) => {
            store.value = value;
        }),
        [getValidValue]: () =>
            validateAgainstZod(schema, store.value, store.approved),
    });

    return store;
};

export type Options<T extends [Primitive, ...Array<Primitive>]> = z.ZodUnion<{
    [K in keyof T]: z.ZodLiteral<T[K]>;
}>;

export const options = <T extends [Primitive, ...Array<Primitive>]>(
    ...options: T
): Options<T> => {
    // @ts-expect-error ts can't infer this yet
    return z.union(options.map((x) => z.literal(x)));
};

export type ParsedInput<State, Z extends z.ZodTypeAny> = {
    state: State;
    approved: boolean;
    [setApproved]: (value: boolean) => void;
    [getCurrentValue]: () => Value<Z> | ValidationError;
    [setCurrentValue]: (value: Value<Z>) => void;
    [getValidValue]: () => z.infer<Z> | ValidationError;
};

export const parsedInput = <State, Schema extends z.ZodTypeAny>(
    state: State,
    currentValueToState: (value: Value<Schema>) => State,
    stateToCurrentValue: (state: State) => Value<Schema> | ValidationError,
    schema: Schema
): ParsedInput<State, Schema> => {
    const initialValue: Value<Schema> =
        informalDefined in schema
            ? (schema[informalDefined] as unknown as Value<Schema>)
            : (undefined as unknown as Value<Schema>);

    const store: ParsedInput<State, Schema> = observable({
        state,
        approved: false,
        [setApproved]: action((value: boolean) => {
            store.approved = value;
        }),
        [getCurrentValue]: () => {
            reportApprovalStatus(store.approved);
            const result = stateToCurrentValue(store.state);
            if (isValidationError(result)) {
                result.approved = store.approved;
                return result;
            }
            return result;
        },
        [setCurrentValue]: action((value: Value<Schema>) => {
            store.state = currentValueToState(value);
        }),
        [getValidValue]: () => {
            const currentValue = store[getCurrentValue]();
            if (isValidationError(currentValue)) {
                return currentValue;
            }

            return validateAgainstZod(schema, currentValue, store.approved);
        },
    });

    if (typeof initialValue !== undefined) {
        store[setCurrentValue](initialValue);
    }

    return store;
};
