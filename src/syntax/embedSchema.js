const UINT24_MAX = Math.pow(2, 24) - 1;
const ISO_8601 = /^(\d{4})-(\d\d)-(\d\d)([T ](\d\d):(\d\d):(\d\d)(\.\d+)?(Z)?)?$/;


export const embedSchema = {
  'type': 'object',
  'minProperties': 1,
  'additionalProperties': false,
  'properties': {
    'title': { 'type': 'string', 'maxLength': 256},
    'url': { 'type': 'string' },
    'description': { 'type': 'string', 'maxLength': 2048},
    'timestamp': { 'type': 'string', 'pattern': ISO_8601.source },
    'color': { 'type': 'integer', 'maximum': UINT24_MAX },
    'footer': {
      'type': 'object',
      'additionalProperties': false,
      'properties': {
        'text': { 'type': 'string', 'maxLength': 2048},
        'icon_url': { 'type': 'string' },
        'proxy_icon_url': {}
      }
    },
    'image': {
      'type': 'object',
      'additionalProperties': false,
      'properties': {
        'url': { 'type': 'string' },
        'proxy_url': {},
        'width': {},
        'height': {}
      }
    },
    'thumbnail': {
      'type': 'object',
      'additionalProperties': false,
      'properties': {
        'url': { 'type': 'string' },
        'proxy_url': {},
        'width': {},
        'height': {}
      }
    },
    'author': {
      'type': 'object',
      'additionalProperties': false,
      'required': ['name'],
      'properties': {
        'name': { 'type': 'string', 'maxLength': 256},
        'url': { 'type': 'string' },
        'icon_url': { 'type': 'string' },
        'proxy_icon_url': {}
      }
    },
    'fields': {
      'type': 'array',
      'maxItems': 25,
      'items': {
        'type': 'object',
        'additionalProperties': false,
        'required': ['name', 'value'],
        'properties': {
          'name': { 'type': 'string', 'maxLength': 256},
          'value': { 'type': 'string', 'maxLength': 1024},
          'inline': { 'type': 'boolean' }
        }
      }
    },
    'provider': {},
    'video': {},
    'type': {}
  }
};  