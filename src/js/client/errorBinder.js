/* globals fluid */
(function () {
    "use strict";
    var gpii = fluid.registerNamespace("gpii");
    fluid.registerNamespace("gpii.schemas.client.errorBinder");

    gpii.schemas.client.errorBinder.displayErrors = function (that) {
        // Get rid of any previous validation errors.
        that.locate("validationError").remove();

        // Step through the list of bindings and look for anything that matches the current validation errors.
        fluid.each(that.options.errorBindings, function (value, key) {
            var selector     = typeof value === "string" ? key   : value.selector;
            var element      = that.locate(selector);
            if (element) {
                // TODO:  Make an expander to automatically convert paths in binder definitions to usable dataPath values.
                var expectedPath = "." + (typeof value === "string" ? value : value.path);
                fluid.each(that.model.fieldErrors, function (error) {
                    if (error.dataPath === expectedPath) {
                        // element, key, context
                        that.renderer.before(element, that.options.templates.inlineError, error);
                    }
                });
            }
        });

        // We have inserted new elements and need to fire an event so that interested parties can update their bindings.
        that.events.onDomBind.fire(that);
    };

    fluid.defaults("gpii.schemas.client.errorBinder", {
        gradeNames: ["fluid.component"],
        errorBindings: "{that}.options.bindings",
        validationErrorClass: "validationError",
        selectors: {
            "validationError": ".validationError"
        },
        model: {
            fieldErrors: [
                {
                    "keyword": "required",
                    "dataPath": ".username",
                    "message": "Username is a required field."
                },
                {
                    "keyword": "pattern",
                    "dataPath": ".password",
                    "message": "Passwords must be at least 8 characters long, and must contain at least one uppercase character, lowercase character, and special character or number."
                }
            ]
        },
        components: {
            // This very much will not work unless you pass in template content yourself.
            renderer: {
                type: "gpii.templates.renderer"
            }
        },
        modelListeners: {
            fieldErrors: {
                funcName: "gpii.schemas.client.errorBinder.displayErrors",
                excludeSource: "init",
                args: ["{that}"]
            }
        }
    });

/*

    These client side grades use model->view bindings like those used with `gpii.templates.binder` to associate
    validation errors reported by the validator with onscreen elements.  That "binding" structure looks something like:

    ```
    bindings: {
        "key": {
            selector: "selector1",
            path:     "path1"
        },
        "selector2": "path2"
    }
    ```

    The map of bindings used by the base component are stored under `options.errorBindings`.  By default, the component
    tries to pick up the existing value from `options.bindings`, so that you can easily reuse existing bindings from
    grades like 'templateFormControl`.

    The core grade requires a `gpii-handlebars` `renderer` component.  An extended version of the `templateFormControl`
    grade that performs all the necessary wiring is also included here.

 */
/* global fluid */

    // TODO: revalidate using client-side validation when the model changes.

    // TODO: Prevent the form from submitting via the normal submit button if there are validation errors.

    // TODO: Create a version of this form that includes client-side validation
    fluid.defaults("gpii.schemas.client.errorAwareForm", {
        gradeNames: ["gpii.schemas.client.errorBinder", "gpii.templates.templateFormControl"],
        rules: {
            successResponseToModel: {
                fieldErrors: { literalValue: null }
            },
            errorResponseToModel: {
                errorMessage: "responseJSON.message",
                fieldErrors:  "responseJSON.fieldErrors"
            },
            modelToRequestPayload: {
                "": "notfound",
                "username": "username",
                "password": "password"
            }
        },
        components: {
            renderer: {
                type: "gpii.templates.renderer.serverAware",
                options: {
                    listeners: {
                        "onTemplatesLoaded.renderMarkup": {
                            func: "{gpii.schemas.client.errorAwareForm}.renderInitialMarkup"
                        },
                        "onTemplatesLoaded.displayErrors": {
                            funcName: "gpii.schemas.client.errorBinder.displayErrors",
                            args: ["{gpii.schemas.client.errorAwareForm}"]
                        }
                    }
                }
            }
        }
    });
})();