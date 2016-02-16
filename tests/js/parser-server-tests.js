/*

  Test the parser by itself with as little interaction with the validator as possible (only static validator functions used).

  Client-side tests and integration are covered by the validator tests, which make use of the parser internally.

 */
"use strict";
var fluid  =  require("infusion");
var gpii   = fluid.registerNamespace("gpii");
var jqUnit = require("node-jqunit");

require("../../");

require("gpii-express");
gpii.express.loadTestingSupport();

fluid.registerNamespace("gpii.schema.parser.tests.server");

gpii.schema.parser.tests.server.testSchemaCaching = function (that) {
    jqUnit.assertTrue("There should be a dereferenced schema after startup...", Boolean(that.dereferencedSchemas && that.dereferencedSchemas["base.json"]));

    jqUnit.assertTrue("A derived schema should have been correctly dereferenced as well...", Boolean(that.dereferencedSchemas && that.dereferencedSchemas["derived.json"]));
};

gpii.schema.parser.tests.server.validateAndTest = function (validator, schemaKey, content, expected) {
    var output = validator.validate(schemaKey, content);
    jqUnit.assertDeepEq("The output should be as expected...", expected, output);
};

fluid.defaults("gpii.schema.parser.tests.server.caseHolder", {
    gradeNames: ["gpii.express.tests.caseHolder"],
    rawModules: [
        {
            tests: [
                {
                    name: "Testing the initial dereferencing of schema content...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.testSchemaCaching",
                            args:     ["{testEnvironment}.validator.parser"]
                        }
                    ]
                },
                {
                    name: "Testing a single unevolved failure...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "base.json", "{that}.options.input.singleRawFailure", "{that}.options.expected.singleRawFailure"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Testing multiple unevolved `allOf` failures within a single field...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "base.json", "{that}.options.input.multipleRawFailures", "{that}.options.expected.multipleRawFailures"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Testing evolving a single failure in an immediate child of the root...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "evolved.json", "{that}.options.input.evolvedRootFailure", "{that}.options.expected.evolvedRootFailure"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Testing evolving a failure within a top-level required field...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "evolved.json", "{that}.options.input.evolvedRequiredFailure", "{that}.options.expected.evolvedRequiredFailure"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Testing evolving the message for a deep required field...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "evolved-overlay.json", "{that}.options.input.evolvedDeepFailure", "{that}.options.expected.evolvedDeepFailure"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Testing evolving a failure within an 'allOf' field...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "evolved.json", "{that}.options.input.evolvedArrayFailure", "{that}.options.expected.evolvedArrayFailure"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Confirm that a valid record still validates when there is error metadata...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "evolved.json", "{that}.options.input.evolvedButValid", "{that}.options.expected.evolvedButValid"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Testing replacing a message in an underlying schema...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "evolved-overlay.json", "{that}.options.input.overlayedRootFailure", "{that}.options.expected.overlayedRootFailure"] // validator, schemaKey, content, expected
                        }
                    ]
                },
                {
                    name: "Testing preserving a message in an underlying schema...",
                    type: "test",
                    sequence: [
                        {
                            funcName: "gpii.schema.parser.tests.server.validateAndTest",
                            args:     ["{testEnvironment}.validator", "evolved-overlay.json", "{that}.options.input.inheritedFailure", "{that}.options.expected.inheritedFailure"] // validator, schemaKey, content, expected
                        }
                    ]
                }
            ]
        }
    ],
    input: {
        singleRawFailure:       {},
        multipleRawFailures:    { required: true, password: "pass" },
        evolvedRootFailure:     { shallowlyRequired: true, testString: "ThunderCAT"},
        overlayedRootFailure:   { shallowlyRequired: true, testString: "ThunderCAT"},
        inheritedFailure:       { shallowlyRequired: true, testString: "UnderDOG"},
        evolvedDeepFailure:     { shallowlyRequired: true, deep: {}},
        evolvedArrayFailure:    { shallowlyRequired: true, testAllOf: "ThunderCAT"},
        evolvedRequiredFailure: {},
        evolvedButValid:        { shallowlyRequired: true }
    },
    expected: {
        singleRawFailure: [
            {
                "keyword": "required",
                "dataPath": "",
                "schemaPath": "#/required",
                "params": {
                    "missingProperty": "required"
                },
                "message": "should have required property 'required'"
            }
        ],
        multipleRawFailures: [
            {
                "keyword": "minLength",
                "dataPath": ".password",
                "schemaPath": "#/definitions/password/allOf/0/minLength",
                "params": {
                    "limit": 8
                },
                "message": "should NOT be shorter than 8 characters"
            },
            {
                "keyword": "pattern",
                "dataPath": ".password",
                "schemaPath": "#/definitions/password/allOf/1/pattern",
                "params": {
                    "pattern": "[A-Z]+"
                },
                "message": "should match pattern \"[A-Z]+\""
            },
            {
                "keyword": "pattern",
                "dataPath": ".password",
                "schemaPath": "#/definitions/password/allOf/3/pattern",
                "params": {
                    "pattern": "[^a-zA-Z]"
                },
                "message": "should match pattern \"[^a-zA-Z]\""
            }
        ],
        evolvedRootFailure: [{
            "keyword": "maxLength",
            "dataPath": ".testString",
            "schemaPath": "#/definitions/testString/maxLength",
            "params": {
                "limit": 9
            },
            "message": "You must enter a string that is no more than nine characters long."
        }],
        overlayedRootFailure: [{
            "keyword": "maxLength",
            "dataPath": ".testString",
            "schemaPath": "evolved.json#/definitions/testString/maxLength",
            "params": {
                "limit": 9
            },
            "message": "You must enter a BETTER string that is no more than nine characters long."
        }],
        inheritedFailure: [{
            "keyword": "pattern",
            "dataPath": ".testString",
            "schemaPath": "evolved.json#/definitions/testString/pattern",
            "params": {
                "pattern": ".*CAT.*"
            },
            "message": "You must enter a string which contains the word \"CAT\"."
        }],
        evolvedDeepFailure: [{
            "keyword": "required",
            "dataPath": ".deep",
            "schemaPath": "evolved.json#/definitions/deep/required",
            "params": {
                "missingProperty": "deeplyRequired"
            },
            "message": "should have required property 'deeplyRequired'"
        }],
        evolvedArrayFailure: [{
            "keyword": "maxLength",
            "dataPath": ".testAllOf",
            "schemaPath": "#/definitions/testAllOf/allOf/2/maxLength",
            "params": {
                "limit": 9
            },
            "message": "The string cannot be longer than nine characters."
        }],
        evolvedRequiredFailure: [{
            "keyword": "required",
            "dataPath": "",
            "schemaPath": "#/required",
            "params": {
                "missingProperty": "shallowlyRequired"
            },
            "message": "The 'shallowlyRequired' field is required."
        }],
        evolvedButValid: undefined
    }
});

fluid.defaults("gpii.schema.parser.tests.server.environment", {
    gradeNames: ["fluid.test.testEnvironment"],
    events: {
        constructServer:  null,
        onSchemasUpdated: null,
        onStarted: {
            events: {
                onSchemasUpdated: "onSchemasUpdated"
            }
        }
    },
    distributeOptions: {
        target: "{that > gpii.schema.validator.ajv.server}.options.components.parser.options.listeners.onSchemasUpdated",
        record: {
            func: "{testEnvironment}.events.onSchemasUpdated.fire"
        }
    },
    components: {
        validator: {
            type: "gpii.schema.validator.ajv.server",
            createOnEvent: "constructServer",
            options: {
                schemaPath: "%gpii-json-schema/tests/schemas"
            }
        },
        caseHolder: {
            type: "gpii.schema.parser.tests.server.caseHolder"
        }
    }
});

gpii.schema.parser.tests.server.environment();

