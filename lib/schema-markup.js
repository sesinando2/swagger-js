'use strict';

var Helpers = require('./helpers');

var _ = {
  isPlainObject: require('lodash-compat/lang/isPlainObject'),
  isUndefined: require('lodash-compat/lang/isUndefined'),
  isArray: require('lodash-compat/lang/isArray'),
  isObject: require('lodash-compat/lang/isObject'),
  isEmpty: require('lodash-compat/lang/isEmpty'),
  map: require('lodash-compat/collection/map'),
  indexOf: require('lodash-compat/array/indexOf'),
  cloneDeep: require('lodash-compat/lang/cloneDeep'),
  keys: require('lodash-compat/object/keys'),
  forEach: require('lodash-compat/collection/forEach')
};

var optionHtml = module.exports.optionHtml = function  (label, value) {
  return '<tr><td class="optionName">' + label + ':</td><td>' + value + '</td></tr>';
};

module.exports.typeFromJsonSchema = function (type, format) {
  var str;

  if (type === 'integer' && format === 'int32') {
    str = 'integer';
  } else if (type === 'integer' && format === 'int64') {
    str = 'long';
  } else if (type === 'integer' && typeof format === 'undefined') {
    str = 'long';
  } else if (type === 'string' && format === 'date-time') {
    str = 'date-time';
  } else if (type === 'string' && format === 'date') {
    str = 'date';
  } else if (type === 'number' && format === 'float') {
    str = 'float';
  } else if (type === 'number' && format === 'double') {
    str = 'double';
  } else if (type === 'number' && typeof format === 'undefined') {
    str = 'double';
  } else if (type === 'boolean') {
    str = 'boolean';
  } else if (type === 'string') {
    str = 'string';
  }

  return str;
};

var getStringSignature = module.exports.getStringSignature = function (obj, baseComponent) {
  var str = '';

  if (typeof obj.$ref !== 'undefined') {
    str += Helpers.simpleRef(obj.$ref);
  } else if (typeof obj.type === 'undefined') {
    str += 'object';
  } else if (obj.type === 'array') {
    if (baseComponent) {
      str += getStringSignature((obj.items || obj.$ref || {}));
    } else {
      str += 'Array[';
      str += getStringSignature((obj.items || obj.$ref || {}));
      str += ']';
    }
  } else if (obj.type === 'integer' && obj.format === 'int32') {
    str += 'integer';
  } else if (obj.type === 'integer' && obj.format === 'int64') {
    str += 'long';
  } else if (obj.type === 'integer' && typeof obj.format === 'undefined') {
    str += 'long';
  } else if (obj.type === 'string' && obj.format === 'date-time') {
    str += 'date-time';
  } else if (obj.type === 'string' && obj.format === 'date') {
    str += 'date';
  } else if (obj.type === 'string' && typeof obj.format === 'undefined') {
    str += 'string';
  } else if (obj.type === 'number' && obj.format === 'float') {
    str += 'float';
  } else if (obj.type === 'number' && obj.format === 'double') {
    str += 'double';
  } else if (obj.type === 'number' && typeof obj.format === 'undefined') {
    str += 'double';
  } else if (obj.type === 'boolean') {
    str += 'boolean';
  } else if (obj.$ref) {
    str += Helpers.simpleRef(obj.$ref);
  } else {
    str += obj.type;
  }

  return str;
};

var schemaToJSON = module.exports.schemaToJSON = function (schema, models, modelsToIgnore, modelPropertyMacro) {
  // Resolve the schema (Handle nested schemas)
  schema = Helpers.resolveSchema(schema);

  if(typeof modelPropertyMacro !== 'function') {
    modelPropertyMacro = function(prop){
      return (prop || {}).default;
    };
  }

  modelsToIgnore= modelsToIgnore || {};

  var type = schema.type || 'object';
  var format = schema.format;
  var model;
  var output;

  if (!_.isUndefined(schema.example)) {
    output = schema.example;
  } else if (_.isUndefined(schema.items) && _.isArray(schema.enum)) {
    output = schema.enum[0];
  }

  if (_.isUndefined(output)) {
    if (schema.$ref) {
      model = models[Helpers.simpleRef(schema.$ref)];

      if (!_.isUndefined(model)) {
        if (_.isUndefined(modelsToIgnore[model.name])) {
          modelsToIgnore[model.name] = model;
          output = schemaToJSON(model.definition, models, modelsToIgnore, modelPropertyMacro);
          delete modelsToIgnore[model.name];
        } else {
          if (model.type === 'array') {
            output = [];
          } else {
            output = {};
          }
        }
      }
    } else if (!_.isUndefined(schema.default)) {
      output = schema.default;
    } else if (type === 'string') {
      if (format === 'date-time') {
        output = new Date().toISOString();
      } else if (format === 'date') {
        output = new Date().toISOString().split('T')[0];
      } else {
        output = 'string';
      }
    } else if (type === 'integer') {
      output = 0;
    } else if (type === 'number') {
      output = 0.0;
    } else if (type === 'boolean') {
      output = true;
    } else if (type === 'object') {
      output = {};

      _.forEach(schema.properties, function (property, name) {
          var cProperty = _.cloneDeep(property);

          // Allow macro to set the default value
          cProperty.default = modelPropertyMacro(property);

          var hasExample = function (schema) {
            if (schema.$ref) {
              var model = models[Helpers.simpleRef(schema.$ref)]
              if (model && model.definition) {
                schema = model.definition;
              }
            }

            if (schema.type === 'object') {
              for (var propertyName in schema.properties) {
                var property = schema.properties[propertyName];
                if (hasExample(property)) {
                  return true;
                }
              }

              return false;
              } else {
                return !_.isUndefined(schema.example);
              }
          };

          var isRequired = schema.required && (schema.required.indexOf(name) >= 0);

          if (hasExample(property) || isRequired) {
              output[name] = schemaToJSON(cProperty, models, modelsToIgnore, modelPropertyMacro);
          }
      });
    } else if (type === 'array') {
      output = [];

      if (_.isArray(schema.items)) {
        _.forEach(schema.items, function (item) {
          output.push(schemaToJSON(item, models, modelsToIgnore, modelPropertyMacro));
        });
      } else if (_.isPlainObject(schema.items)) {
        output.push(schemaToJSON(schema.items, models, modelsToIgnore, modelPropertyMacro));
      } else if (_.isUndefined(schema.items)) {
        output.push({});
      } else {
        Helpers.log('Array type\'s \'items\' property is not an array or an object, cannot process');
      }
    }
  }

  return output;
};

module.exports.schemaToHTML =function (name, schema, models, modelPropertyMacro) {
  // Allow for ignoring the 'name' argument.... shifting the rest
  if(_.isObject(arguments[0])) {
    name = void 0;
    schema = arguments[0];
    models = arguments[1];
    modelPropertyMacro = arguments[2];
  }

  models = models || {};

  // Resolve the schema (Handle nested schemas)
  schema = Helpers.resolveSchema(schema);

  // Dereference $ref from 'models'
  if(typeof schema.$ref === 'string') {
    name = Helpers.simpleRef(schema.$ref);
    schema = models[name];
    if(typeof schema === 'undefined')
    {
        throw error(name + ' is not defined!')
    }
  }

  if(typeof name !== 'string') {
    name = schema.title || 'Inline Model';
  }

  // If we are a Model object... adjust accordingly
  if(schema.definition) {
    schema = schema.definition;
  }

  if(typeof modelPropertyMacro !== 'function') {
    modelPropertyMacro = function(prop){
      return (prop || {}).default;
    };
  }

  var references = {};
  var seenModels = [];
  var inlineModels = 0;

  // Generate current HTML
  var html = processModel(schema, name);

  // Generate references HTML
  while (_.keys(references).length > 0) {
    /* jshint ignore:start */
    _.forEach(references, function (schema, name) {
      var seenModel = _.indexOf(seenModels, name) > -1;

      delete references[name];

      if (!seenModel) {
        seenModels.push(name);

        html += processModel(schema, name);
      }
    });
    /* jshint ignore:end */
  }

  return html;

  /////////////////////////////////

  function addReference(schema, name, skipRef) {
    var modelName = name;
    var model;

    if (schema.$ref) {
      modelName = schema.title || Helpers.simpleRef(schema.$ref);
      model = models[modelName];

      if (model !== null && model.definition.title !== null && typeof model.definition.title !== 'undefined') {
          modelName = model.definition.title;
      }
    } else if (_.isUndefined(name)) {
      modelName = schema.title || 'Inline Model ' + (++inlineModels);
      model = {definition: schema};
    }

    if (skipRef !== true) {
      references[modelName] = _.isUndefined(model) ? {} : model.definition;
    }

    return modelName;
  }

  function primitiveToHTML(schema) {
    var html = '<span class="propType"';
    var type = schema.type || 'object';
    var ref;

    if (schema.$ref) {
      ref = addReference(schema, Helpers.simpleRef(schema.$ref));
      html += ' title=' + ref + '>' + ref;
    } else if (type === 'object') {
      if (!_.isUndefined(schema.properties)) {
        ref = addReference(schema);
        html += ' title=' + ref + '>' + ref;
      } else {
        html += ' title="object">object';
      }
    } else if (type === 'array') {
      html += 'Array[';

      if (_.isArray(schema.items)) {
        ref = _.map(schema.items, addReference).join(',');
      } else if (_.isPlainObject(schema.items)) {
        if (_.isUndefined(schema.items.$ref)) {
          if (!_.isUndefined(schema.items.type) && _.indexOf(['array', 'object'], schema.items.type) === -1) {
            ref = schema.items.type;
          } else {
            ref = addReference(schema.items);
          }
        } else {
            ref = addReference(schema.items, Helpers.simpleRef(schema.items.$ref));
        }
      } else {
        Helpers.log('Array type\'s \'items\' schema is not an array or an object, cannot process');
        ref += 'object';
      }

        html += ' title=array[' + ref + ']>array[' + ref + ']';
    } else {
        html += ' title=' + schema.type + '>' + schema.type ;
    }

    html += '</span>';

    return html;
  }

  function primitiveToOptionsHTML(schema, html) {
    var options = '';
    var type = schema.type || 'object';
    var isArray = type === 'array';

    if (isArray) {
      if (_.isPlainObject(schema.items) && !_.isUndefined(schema.items.type)) {
        type = schema.items.type;
      } else {
        type = 'object';
      }
    }

    if (!_.isUndefined(schema.default)) {
      options += optionHtml('Default', schema.default);
    }

    switch (type) {
    case 'string':
      if (schema.minLength) {
        options += optionHtml('Min. Length', schema.minLength);
      }

      if (schema.maxLength) {
        options += optionHtml('Max. Length', schema.maxLength);
      }

      if (schema.pattern) {
        options += optionHtml('Reg. Exp.', schema.pattern);
      }
      break;
    case 'integer':
    case 'number':
      if (schema.minimum) {
        options += optionHtml('Min. Value', schema.minimum);
      }

      if (schema.exclusiveMinimum) {
        options += optionHtml('Exclusive Min.', 'true');
      }

      if (schema.maximum) {
        options += optionHtml('Max. Value', schema.maximum);
      }

      if (schema.exclusiveMaximum) {
        options += optionHtml('Exclusive Max.', 'true');
      }

      if (schema.multipleOf) {
        options += optionHtml('Multiple Of', schema.multipleOf);
      }

      break;
    }

    if (isArray) {
      if (schema.minItems) {
        options += optionHtml('Min. Items', schema.minItems);
      }

      if (schema.maxItems) {
        options += optionHtml('Max. Items', schema.maxItems);
      }

      if (schema.uniqueItems) {
        options += optionHtml('Unique Items', 'true');
      }

      if (schema.collectionFormat) {
        options += optionHtml('Coll. Format', schema.collectionFormat);
      }
    }

    if (_.isUndefined(schema.items)) {
      if (_.isArray(schema.enum)) {
        var enumString;

        if (type === 'number' || type === 'integer') {
          enumString = schema.enum.join(', ');
        } else {
          enumString = '"' + schema.enum.join('", "') + '"';
        }

        options += optionHtml('Enum', enumString);
      }
    }

    return html;
  }

  function processModel(schema, name) {
    var type = schema.type || 'object';
    var isArray = schema.type === 'array';
    var strongOpen = '<span class="strong objectName"><span class="bracketsIcon">' + (isArray ? '[]' : '{}') + '</span> <span class="objectNameText">';
    var strongClose = '</span></span>';
    var html = '';

    if (name !== 'Inline Model') {
      if (!_.isUndefined(schema.title)) {
        html = strongOpen + schema.title + strongClose;
      } else {
        html = strongOpen + name + strongClose;
      }
    }

    if (name) {
      seenModels.push(name);
    }

    if (isArray) {
      if (_.isArray(schema.items)) {
        html += '<div>' + _.map(schema.items, function (item) {
          var type = item.type || 'object';

          if (_.isUndefined(item.$ref)) {
            if (_.indexOf(['array', 'object'], type) > -1) {
              if (type === 'object' && _.isUndefined(item.properties)) {
                return 'object';
              } else {
                return addReference(item);
              }
            } else {
              return primitiveToOptionsHTML(item, type);
            }
          } else {
            return addReference(item, Helpers.simpleRef(item.$ref));
          }
        }).join('</div><div>');
      } else if (_.isPlainObject(schema.items)) {
        var ref = '';
        if (_.isUndefined(schema.items.$ref)) {
          if (_.indexOf(['array', 'object'], schema.items.type || 'object') > -1) {
            if ((_.isUndefined(schema.items.type) || schema.items.type === 'object') && _.isUndefined(schema.items.properties)) {
              ref = 'object';
            } else {
              ref = addReference(schema.items);
            }
          } else {
            ref = primitiveToOptionsHTML(schema.items, schema.items.type);
          }
        } else {
            ref = addReference(schema.items, Helpers.simpleRef(schema.items.$ref));
        }
        if (name !== 'Inline Model') {
            html += '<div>' + ref + '</div>';
        }
      } else {
        Helpers.log('Array type\'s \'items\' property is not an array or an object, cannot process');
        html += '<div>object</div>';
      }
    } else {
      if (schema.$ref) {
        html += '<div>' + addReference(schema, name) + '</div>';
      } else if (type === 'object') {
        html += '<div>';

        if (_.isPlainObject(schema.properties)) {
          html += _.map(schema.properties, function (property, name) {
              var propertyIsRequired = (_.indexOf(schema.required, name) >= 0),
                  cProperty = _.cloneDeep(property),
                  html = '<span class="propLabels">',
                  model;
              html += '<span class="propName propOpt">' + name + '</span>';

            // Allow macro to set the default value
            cProperty.default = modelPropertyMacro(cProperty);

            // Resolve the schema (Handle nested schemas)
            cProperty = Helpers.resolveSchema(cProperty);

            // We need to handle property references to primitives (Issue 339)
            if (!_.isUndefined(cProperty.$ref)) {
              model = models[Helpers.simpleRef(cProperty.$ref)];

              if (!_.isUndefined(model) && _.indexOf([undefined, 'array', 'object'], model.definition.type) === -1) {
                // Use referenced schema
                cProperty = Helpers.resolveSchema(model.definition);
              }
            }

            html += primitiveToHTML(cProperty);

            if(!propertyIsRequired) {
                html += '<span class="propOptKey">(optional)</span>';
            }

            html += '</span>';

            html += '<span class="propDesc">';

            if (!_.isUndefined(property.description)) {
              html += property.description;
            }

            if (cProperty.enum) {
              html += '<div class="propVals">Can be ';
              _.forEach(cProperty.enum, function (value, key) {
                html += '<code>' + value + '</code>';
                if (key === cProperty.enum.length - 2) {
                    html += ' or ';
                }
                else if (key < cProperty.enum.length - 1) {
                    html += ', ';
                }
              });
              html += '</div>';
            }

            html += '</span>';

            return primitiveToOptionsHTML(cProperty, html);
          }).join('</div><div>');
        }

        html += '</div>';
      } else {
        html += '<div>' + primitiveToOptionsHTML(schema, type) + '</div>';
      }
    }

    return html;
  }
};