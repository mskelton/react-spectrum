/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {AriaButtonProps} from '@react-types/button';
import {AriaDatePickerProps, AriaDateRangePickerProps, DateValue} from '@react-types/datepicker';
import {AriaDialogProps} from '@react-types/dialog';
import {createFocusManager} from '@react-aria/focus';
import {DateRangePickerState} from '@react-stately/datepicker';
import {DOMAttributes, FormValidationEvent, KeyboardEvent} from '@react-types/shared';
import {composeValidate, filterDOMProps, FormValidationResult, mergeProps, mergeValidity, mapValidate, useDescription, useFormValidationState, useId} from '@react-aria/utils';
import {focusManagerSymbol, roleSymbol} from './useDateField';
// @ts-ignore
import intlMessages from '../intl/*.json';
import {RangeCalendarProps} from '@react-types/calendar';
import {RefObject, useMemo, useRef} from 'react';
import {useDatePickerGroup} from './useDatePickerGroup';
import {useField} from '@react-aria/label';
import {useFocusWithin} from '@react-aria/interactions';
import {useLocale, useLocalizedStringFormatter} from '@react-aria/i18n';

export interface DateRangePickerAria extends FormValidationResult {
  /** Props for the date range picker's visible label element, if any. */
  labelProps: DOMAttributes,
  /** Props for the grouping element containing the date fields and button. */
  groupProps: DOMAttributes,
  /** Props for the start date field. */
  startFieldProps: AriaDatePickerProps<DateValue>,
  /** Props for the end date field. */
  endFieldProps: AriaDatePickerProps<DateValue>,
  /** Props for the popover trigger button. */
  buttonProps: AriaButtonProps,
  /** Props for the description element, if any. */
  descriptionProps: DOMAttributes,
  /** Props for the error message element, if any. */
  errorMessageProps: DOMAttributes,
  /** Props for the popover dialog. */
  dialogProps: AriaDialogProps,
  /** Props for the range calendar within the popover dialog. */
  calendarProps: RangeCalendarProps<DateValue>
}

/**
 * Provides the behavior and accessibility implementation for a date picker component.
 * A date range picker combines two DateFields and a RangeCalendar popover to allow
 * users to enter or select a date and time range.
 */
export function useDateRangePicker<T extends DateValue>(props: AriaDateRangePickerProps<T>, state: DateRangePickerState, ref: RefObject<Element>): DateRangePickerAria {
  let stringFormatter = useLocalizedStringFormatter(intlMessages);
  let [startValidation, setStartValidation] = useFormValidationState(props, state.value);
  let [endValidation, setEndValidation] = useFormValidationState(props, state.value);
  let validationState = startValidation.validationState || endValidation.validationState;
  let errorMessage = startValidation.errorMessage || endValidation.errorMessage;
  let validationDetails = mergeValidity(startValidation.validationDetails, endValidation.validationDetails);
  let {labelProps, fieldProps, descriptionProps, errorMessageProps} = useField({
    ...props,
    labelElementType: 'span',
    validationState,
    errorMessage
  });

  let labelledBy = fieldProps['aria-labelledby'] || fieldProps.id;

  let {locale} = useLocale();
  let range = state.formatValue(locale, {month: 'long'});
  let description = range ? stringFormatter.format('selectedRangeDescription', {startDate: range.start, endDate: range.end}) : '';
  let descProps = useDescription(description);

  let startFieldProps = {
    'aria-label': stringFormatter.format('startDate'),
    'aria-labelledby': labelledBy
  };

  let endFieldProps = {
    'aria-label': stringFormatter.format('endDate'),
    'aria-labelledby': labelledBy
  };

  let buttonId = useId();
  let dialogId = useId();

  let groupProps = useDatePickerGroup(state, ref);

  let ariaDescribedBy = [descProps['aria-describedby'], fieldProps['aria-describedby']].filter(Boolean).join(' ') || undefined;
  let focusManager = useMemo(() => createFocusManager(ref, {
    // Exclude the button from the focus manager.
    accept: element => element.id !== buttonId
  }), [ref, buttonId]);

  let commonFieldProps = {
    [focusManagerSymbol]: focusManager,
    [roleSymbol]: 'presentation',
    'aria-describedby': ariaDescribedBy,
    minValue: props.minValue,
    maxValue: props.maxValue,
    placeholderValue: props.placeholderValue,
    hideTimeZone: props.hideTimeZone,
    hourCycle: props.hourCycle,
    granularity: props.granularity,
    isDisabled: props.isDisabled,
    isReadOnly: props.isReadOnly,
    isRequired: props.isRequired,
    validationBehavior: props.validationBehavior,
    validationState: props.validationState,
    errorMessage: props.errorMessage,
    validate: composeValidate(mapValidate(props.validate, () => state.value), () => {
      let value = state.value;
      if ((value.start && props.isDateUnavailable?.(value.start)) || (value.end && props.isDateUnavailable?.(value.end))) {
        return 'Selected dates unavailable';
      }

      if (value.end != null && value.start != null && value.end.compare(value.start) < 0) {
        return 'End date must be after start date';
      }
    }),
  };

  let domProps = filterDOMProps(props);

  let {focusWithinProps} = useFocusWithin({
    ...props,
    isDisabled: state.isOpen,
    onBlurWithin: props.onBlur,
    onFocusWithin: props.onFocus,
    onFocusWithinChange: props.onFocusChange
  });

  let validityRef = useRef(null);
  let onValidationChange = (v: FormValidationEvent) => {
    let c = validityRef.current;

    // Ignore duplicate events.
    if (
      c &&
      c.errorMessage === v.errorMessage &&
      Object.entries(v.validationDetails).every(([k, v]) => c.validationDetails[k] === v)
    ) {
      return;
    }

    validityRef.current = v;
    if (props.onValidationChange) {
      props.onValidationChange(v);
    }
  };

  return {
    groupProps: mergeProps(domProps, groupProps, fieldProps, descProps, focusWithinProps, {
      role: 'group',
      'aria-disabled': props.isDisabled || null,
      'aria-describedby': ariaDescribedBy,
      onKeyDown(e: KeyboardEvent) {
        if (state.isOpen) {
          return;
        }

        if (props.onKeyDown) {
          props.onKeyDown(e);
        }
      },
      onKeyUp(e: KeyboardEvent) {
        if (state.isOpen) {
          return;
        }

        if (props.onKeyUp) {
          props.onKeyUp(e);
        }
      }
    }),
    labelProps: {
      ...labelProps,
      onClick: () => {
        focusManager.focusFirst();
      }
    },
    buttonProps: {
      ...descProps,
      id: buttonId,
      'aria-haspopup': 'dialog',
      'aria-label': stringFormatter.format('calendar'),
      'aria-labelledby': `${buttonId} ${labelledBy}`,
      'aria-describedby': ariaDescribedBy,
      'aria-expanded': state.isOpen || undefined,
      onPress: () => state.setOpen(true)
    },
    dialogProps: {
      id: dialogId,
      'aria-labelledby': `${buttonId} ${labelledBy}`
    },
    startFieldProps: {
      ...startFieldProps,
      ...commonFieldProps,
      value: state.value?.start,
      onChange: start => state.setDateTime('start', start),
      autoFocus: props.autoFocus,
      name: props.startName,
      onValidationChange(v) {
        setStartValidation(v);
        onValidationChange(getValidationEvent(v, validationResultToEvent(endValidation)));
      }
    },
    endFieldProps: {
      ...endFieldProps,
      ...commonFieldProps,
      value: state.value?.end,
      onChange: end => state.setDateTime('end', end),
      name: props.endName,
      onValidationChange(v) {
        setEndValidation(v);
        onValidationChange(getValidationEvent(validationResultToEvent(startValidation), v));
      }
    },
    descriptionProps,
    errorMessageProps,
    calendarProps: {
      autoFocus: true,
      value: state.dateRange,
      onChange: state.setDateRange,
      minValue: props.minValue,
      maxValue: props.maxValue,
      isDisabled: props.isDisabled,
      isReadOnly: props.isReadOnly,
      isDateUnavailable: props.isDateUnavailable,
      allowsNonContiguousRanges: props.allowsNonContiguousRanges,
      defaultFocusedValue: state.dateRange ? undefined : props.placeholderValue,
      validationState: state.validationState,
      errorMessage: props.errorMessage
    },
    validationState,
    errorMessage,
    validationDetails
  };
}

function getValidationEvent(a: FormValidationEvent, b: FormValidationEvent): FormValidationEvent {
  let isInvalid = a.isInvalid || b.isInvalid;
  let errorMessage = a.errorMessage || b.errorMessage;
  let validationDetails = mergeValidity(a.validationDetails, b.validationDetails);
  return {isInvalid, errorMessage, validationDetails};
}

function validationResultToEvent(result: FormValidationResult): FormValidationEvent {
  return {
    isInvalid: !result.validationDetails.valid,
    errorMessage: typeof result.errorMessage === 'string' ? result.errorMessage : '',
    validationDetails: result.validationDetails
  };
}
