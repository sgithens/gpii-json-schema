/*

A Fluid Component to handle JSON Schema validation.

Pass JSON content to this component's `validate(schemaKey, JSON)` invoker, and it
will be parsed using [Z-Schema](https://github.com/zaggino/z-schema).

You are expected to configure one or more schemas which will be read from `options.schemaContents`.  The `schemaKey`
value passed to `validate` is expected to match one of the keys in `options.schemaContent`.

You can change the behavior of Z-Schema by updating `options.zSchemaOptions` (check their documentation for the syntax).

If there are no validation errors, we return `undefined` (as does Z-Schema).  If there are validation errors, the raw
output generated by Z-Schema is transformed using the static function `sanitizeValidationErrors`.

As an example, let's assume that you have a JSON payload like the following that you wish to validate:

  ```
  {
    field1: "invalid",
    category1: {
      nestedField1: "invalid"
    }
  }
  ```

Assuming that each value was invalid, you might see validation output like the following:

  ```
  {
    documentErrors: []
    fieldErrors: {
      field1: ["field1 must be 8 characters or longer.", "field1 must contain at least one uppercase letter."],
      category1: {
        nestedField1: ["nested field is not a valid number."]
      }
  }
  ```

The `documentErrors` field is reserved for more severe errors, such as passing a non-object to the validator when a
JSON object is expected.

 */
"use strict";
var fluid = fluid || require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.schema.validator");

gpii.schema.validator.validate = function (that, key, content) {
    if (!that.schemaContents[key]) {
        fluid.fail("You tried to validate a component for which we have no schema content.  Can't continue.");
    }

    // We instantiate a new validator each time to avoid detecting errors from previous runs or from other sessions.
    var validator = that.getValidator();

    // We have to validate all schemas at once to a) confirm that we have usable schemas and b) handle dependencies between schemas correctly.
    var schemasValid = validator.validateSchema(Object.keys(that.schemaContents).map(function (v) { return that.schemaContents[v]; }));
    if (!schemasValid) {
        fluid.fail(validator.getLastErrors());
    }

    var contentValid = validator.validate(content, that.schemaContents[key]);
    if (!contentValid) {
        return (gpii.schema.validator.sanitizeValidationErrors(validator.getLastErrors()));
    }

    return undefined;
};

/*
 z-schema gives us output like:

 [
     {
         "code": "OBJECT_MISSING_REQUIRED_PROPERTY",
         "params":["termLabel"],
         "message":"Missing required property: termLabel",
         "path":"#/"
     },
     {
         "code":"PATTERN",
         "params":["^[a-z]+([A-Z][a-z]+)*$","6DotComputerBrailleTable"],
         "message":"String does not match pattern ^[a-z]+([A-Z][a-z]+)*$: 6DotComputerBrailleTable",
         "path":"#/uniqueId"
     }
 ]

 See https://github.com/zaggino/z-schema/blob/master/src/Errors.js for the list of errors and
 https://github.com/zaggino/z-schema/blob/master/src/JsonValidation.js for the logic behind them.

 We need to turn this into something human-readable, especially for pattern-based matches.

 We also need to break it down by field so that we can show feedback in-context;

 */
gpii.schema.validator.sanitizeValidationErrors = function (errors) {
    var sanitizedErrors = { documentErrors: [], fieldErrors: {}};

    fluid.each(errors, function (error) {
        gpii.schema.validator.sanitizeError(error, sanitizedErrors);
    });

    return sanitizedErrors;
};

gpii.schema.validator.sanitizeError = function (error, errorMap) {
    // Errors with fields that contain data are already associated with the field based on the path
    var path = gpii.schema.validator.extractPathSegments(error);

    gpii.schema.validator.saveToPath(path, error.message, errorMap);
};

// Filter to remove empty array segments.  Required because strings like `#/` would otherwise result in an
// extra array element when we run them through `split`.
gpii.schema.validator.removeEmptySegments = function (el) { return el !== undefined && el !== null && el.length > 0; };

/*
  Z-Schema represents validation failures using path notation like `#/category/subcategory/field`.  This function
  converts that notation into a series of path segments that can be passed to `gpii.schema.validator.saveToPath`.

  In addition, this function unifies the two pieces of the z-schema path, `error.params` and `error.path`.  This enables
  us to represent a hierarchy of validation errors.
 */

// TODO:  Handle the special case when a slash is included in the path, which results in output like:
//
// [
//   {
//    "code": "OBJECT_MISSING_REQUIRED_PROPERTY",
//    "params": [
//      "required"
//    ],
//    "message": "Missing required property: required",
//    "path": "#/deep~1slasher"
//  }
//]
//
gpii.schema.validator.extractPathSegments = function (error) {
    var segments = error.path.split("/").filter(gpii.schema.validator.removeEmptySegments).slice(1);
    if (error.code === "OBJECT_MISSING_REQUIRED_PROPERTY" && error.params) { segments = segments.concat(error.params); }
    return segments;
};

// Resolve the underlying data from a hierarchical object using an array of path segments. Returns the portion of the
// original object at the selected path.  As an example:
//
// `resolveOrCreateTargetFromPath({ one: two: three: four: "five"}, ["one", "two", "three"])`
//
// Should return:
//
// `{ four: "five" }`
//
// Note that the relevant portion of the original object is returned, and not just the value.  Note also that if the
// deep structure does not already exist, it will be created.  Thus:
//
// `resolveOrCreateTargetFromPath({},["one","two","three"])`
//
// Will return:
//
// `{ one: two: three: [] }`
//
gpii.schema.validator.resolveOrCreateTargetFromPath = function (target, path) {
    var resolvedTarget = target;
    for (var a = 0; a < path.length; a++) {
        var segment = path[a];
        if (!resolvedTarget[segment]) {
            resolvedTarget[segment] = a === path.length - 1 ? [] : {};
        }

        resolvedTarget = resolvedTarget[segment];
    }
    return resolvedTarget;
};

/*
  A function to save error messages to the right position within our "sanitized" JSON output (see header for example).

  `path`:
    An array of path segments pointing to a variable in `errorMap`.  If you are describing validation errors related to
    the field `category.subcategory.field`, the path would look like `["category", "subcategory", "field"]`.

  `errorString`:
    An error message to be saved to the right `path` within `errorMap`

  `errorMap`:
    A map of error messages for the whole document.  This will be modified with new values.
 */
gpii.schema.validator.saveToPath = function (path, errorString, errorMap) {
    var target = errorMap.fieldErrors;
    // If we have path data, the error is related to a specific field.
    if (path && path.length > 0) {
        target = gpii.schema.validator.resolveOrCreateTargetFromPath(target, path);
    }
    // Otherwise, we are working with a document-level error.
    else {
        target = errorMap.documentErrors;
    }
    target.push(errorString);
};

fluid.defaults("gpii.schema.validator", {
    gradeNames: ["fluid.component"],
    zSchemaOptions: {
        noExtraKeywords:   true,
        // This option does not appear to be respected in our version of z-schema, but we set it explicitly to avoid
        // problems when we upgrade.
        reportPathAsArray: false
    },
    members: {
        schemaContents: {}
    },
    invokers: {
        validate: {
            funcName: "gpii.schema.validator.validate",
            args:     ["{that}", "{arguments}.0", "{arguments}.1"]
        },
        getValidator: {
            funcName: "fluid.notImplemented"
        }
    }
});
