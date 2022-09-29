import { backend, field, parsing } from './field';
import { min, minLength } from './validation';

describe('informal', () => {
    it('Allows reading and writing into a field', () => {
        const name = field<string>();
        name.value = 'Mark';

        expect(name.value).toBe('Mark');

        name.value = 'Joe';
        expect(name.value).toBe('Joe');
    });

    it('Considers all fields required by default', () => {
        const name = field<string>();

        expect(name.getError()?.message).toBe('required');

        name.value = 'Mark';
        expect(name.getError()).toBe(undefined);
    });

    it('Supports passing a validator to a field', () => {
        const name = field(minLength(3));

        // required is always a priority validator
        expect(name.getError()?.message).toBe('required');

        name.value = 'Ma';
        expect(name.getError()).toEqual({
            message: 'minLength',
            params: { min: 3 },
        });

        name.value = 'Mark';
        expect(name.getError()).toBe(undefined);
    });

    it('Supports optional fields', () => {
        const name = field.optional(minLength(3));

        // optional is valid when empty, if not validators are called
        expect(name.getError()).toBe(undefined);

        name.value = 'Ma';
        expect(name.getError()).toEqual({
            message: 'minLength',
            params: { min: 3 },
        });

        name.value = 'Mark';
        expect(name.getError()).toBe(undefined);
    });

    it('Only returns a valid value on submit', () => {
        const name = field(minLength(3));

        name.value = 'Ma';
        expect(name.submit()).toEqual({
            message: 'minLength',
            params: { min: 3 },
        });

        name.value = 'Mark';
        expect(name.submit()).toBe('Mark');
    });

    it('Supports adding and clearing backend error', () => {
        const username = field(minLength(3));

        username.value = 'v-';
        expect(username.submit()).toEqual({
            message: 'minLength',
            params: { min: 3 },
        });

        username.value = 'v-trof';
        expect(username.submit()).toBe('v-trof');

        // shows when set
        username.addError(backend, { message: 'Username v-trof is taken' });
        expect(username.getError()?.message).toBe('Username v-trof is taken');

        // clears on change
        username.addError(backend, { message: 'Username v-trof is taken' });
        username.value = 'vtrof';
        expect(username.getError()).toBe(undefined);

        // clears on submit
        username.addError(backend, { message: 'Username v-trof is taken' });
        expect(username.submit()).toBe('vtrof');
        expect(username.getError()).toBe(undefined);
    });

    it('Supports adding and clearing parsing error', () => {
        const price = field(min(10));

        price.value = 3;
        expect(price.submit()).toEqual({
            message: 'min',
            params: { min: 10 },
        });

        price.value = 15;
        expect(price.submit()).toBe(15);

        // shows when set
        price.addError(parsing, { message: 'Input a valid price' });
        expect(price.getError()?.message).toBe('Input a valid price');

        // clears on change
        price.addError(parsing, { message: 'Input a valid price' });
        price.value = 30;
        expect(price.getError()).toBe(undefined);

        // does not clear on submit
        price.addError(parsing, { message: 'Input a valid price' });
        expect(price.submit()).toEqual({ message: 'Input a valid price' });
        expect(price.getError()?.message).toBe('Input a valid price');
    });
});