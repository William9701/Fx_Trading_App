import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const SUPPORTED = ['NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];

export function IsValidCurrency(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCurrency',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          return SUPPORTED.includes(value?.toUpperCase());
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be one of: ${SUPPORTED.join(', ')}`;
        },
      },
    });
  };
}
