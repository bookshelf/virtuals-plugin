const { deepEqual, equal } = require('assert')
const knex = require('knex')
const db = knex({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true })
const bookshelf = require('bookshelf')(db)
const virtuals = require('..')

describe('Virtuals Plugin', function () {
  before(function () {
    bookshelf.plugin(virtuals)

    return db.schema.createTable('authors', (table) => {
      table.increments('id')
      table.integer('site_id').notNullable()
      table.string('first_name')
      table.string('last_name')
    })
  })

  beforeEach(() => db('authors').truncate())

  after(() => db.destroy())

  it('can create virtual properties on the model', function () {
    const m = new (bookshelf.Model.extend({
      virtuals: {
        fullName() {
          return this.get('firstName') + ' ' + this.get('lastName')
        }
      }
    }))({ firstName: 'Joe', lastName: 'Shmoe' })

    equal(m.fullName, 'Joe Shmoe')
  })

  it('can create virtual properties with getter and setter', function () {
    const m = new (bookshelf.Model.extend({
      virtuals: {
        fullName: {
          get() {
            return this.get('firstName') + ' ' + this.get('lastName')
          },
          set(value) {
            value = value.split(' ')
            this.set('firstName', value[0])
            this.set('lastName', value[1])
          }
        }
      }
    }))({ firstName: 'Joe', lastName: 'Shmoe' })

    equal(m.fullName, 'Joe Shmoe')
    m.fullName = 'Jack Shmoe'

    equal(m.fullName, 'Jack Shmoe')
    equal(m.get('firstName'), 'Jack')
    equal(m.get('lastName'), 'Shmoe')
  })

  it('can access parameterized virtual properties on the model', function () {
    const m = new (bookshelf.Model.extend({
      virtuals: {
        fullName(middleName) {
          if (!middleName) return this.get('firstName') + ' ' + this.get('lastName')
          return this.get('firstName') + ' ' + middleName + ' ' + this.get('lastName')
        }
      }
    }))({ firstName: 'Joe', lastName: 'Shmoe' })

    equal(m.fullName, 'Joe Shmoe')
  })

  it('can set virtual properties in the constructor', function () {
    const m = new (bookshelf.Model.extend({
      virtuals: {
        fullName: {
          get() {
            return this.get('firstName') + ' ' + this.get('lastName')
          },
          set(value) {
            value = value.split(' ')
            this.set('firstName', value[0])
            this.set('lastName', value[1])
          }
        }
      }
    }))({ fullName: 'Peter Griffin', dogName: 'Brian' })

    equal(m.get('firstName'), 'Peter')
    equal(m.get('lastName'), 'Griffin')
    equal(m.get('dogName'), 'Brian')
  })

  it('can set virtual properties in the constructor without setting an actual model attribute', function () {
    const m = new (bookshelf.Model.extend({
      virtuals: {
        fullName: {
          get() {
            return this.get('firstName') + ' ' + this.get('lastName')
          },
          set(value) {
            value = value.split(' ')
            this.set('firstName', value[0])
            this.set('lastName', value[1])
          }
        }
      }
    }))({ fullName: 'Peter Griffin' })

    equal(m.attributes['fullName'], undefined)
  })

  it("saves virtual attributes when passing `'key', 'value'` style arguments", function () {
    const Model = bookshelf.Model.extend({
      tableName: 'authors',
      virtuals: {
        full_name: {
          set(value) {
            value = value.split(' ')
            this.set('first_name', value[0])
            this.set('last_name', value[1])
          },
          get: () => {}
        }
      }
    })

    return Model.forge({ site_id: 1 })
      .save('full_name', 'Oderus Urungus')
      .then((savedModel) => {
        equal(savedModel.get('first_name'), 'Oderus')
        equal(savedModel.get('last_name'), 'Urungus')
      })
  })

  it('save should be rejected after `set` throws an exception during a `patch` operation', function () {
    const Model = bookshelf.Model.extend({
      tableName: 'authors',
      virtuals: {
        will_cause_error: {
          set(fullName) {
            throw new Error('Deliberately failing')
          },
          get: () => {}
        }
      }
    })

    return Model.forge({ id: 4, first_name: 'Ned' })
      .save({ will_cause_error: 'value' }, { patch: true })
      .catch((error) => {
        equal(error.message, 'Deliberately failing')
      })
  })

  it('patches the model\'s "lodash" methods', function () {
    const m = new (bookshelf.Model.extend({
      outputVirtuals: true,
      virtuals: {
        fullName() {
          return this.get('firstName') + ' ' + this.get('lastName')
        }
      }
    }))({ firstName: 'Joe', lastName: 'Shmoe' })

    deepEqual(m.keys(), ['firstName', 'lastName', 'fullName'])
    deepEqual(m.values(), ['Joe', 'Shmoe', 'Joe Shmoe'])
    deepEqual(m.toPairs(), [
      ['firstName', 'Joe'],
      ['lastName', 'Shmoe'],
      ['fullName', 'Joe Shmoe']
    ])
    deepEqual(m.invert(), { Joe: 'firstName', Shmoe: 'lastName', 'Joe Shmoe': 'fullName' })
    deepEqual(m.pick('fullName'), { fullName: 'Joe Shmoe' })
    deepEqual(m.omit('firstName'), { lastName: 'Shmoe', fullName: 'Joe Shmoe' })
  })

  describe('Model#get()', function () {
    it('can access parameterized virtual properties with getter and setter', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName: {
            get(middleName) {
              if (!middleName) return this.get('firstName') + ' ' + this.get('lastName')
              return this.get('firstName') + ' ' + middleName + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })

      equal(m.get('fullName', 'Trouble'), 'Joe Trouble Shmoe')
    })

    it('can access parameterized virtual properties that accept multiple arguments', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName(param1, param2) {
            return this.get('firstName') + ' ' + param1 + ' ' + param2
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })

      equal(m.get('fullName', 'Danger', 'Explosion'), 'Joe Danger Explosion')
    })

    it('can access parameterized virtual properties with getter and setter without passing an argument', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName: {
            get(middleName) {
              if (!middleName) return this.get('firstName') + ' ' + this.get('lastName')
              return this.get('firstName') + ' ' + middleName + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })

      equal(m.get('fullName'), 'Joe Shmoe')
    })
  })

  describe('Model#set()', function () {
    it('can set virtual properties by passing two argument strings', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName: {
            get() {
              return this.get('firstName') + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))()
      m.set('fullName', 'Jack Shmoe')

      equal(m.get('firstName'), 'Jack')
      equal(m.get('lastName'), 'Shmoe')
    })

    it('can set virtual properties by passing an object with values', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName: {
            get() {
              return this.get('firstName') + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))()
      m.set({ fullName: 'Peter Griffin', dogName: 'Brian' })

      equal(m.get('firstName'), 'Peter')
      equal(m.get('lastName'), 'Griffin')
      equal(m.get('dogName'), 'Brian')
    })

    it('does not set actual attribute on model when setting virtual with two argument strings', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName: {
            get() {
              return this.get('firstName') + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))()
      m.set('fullName', 'Jack Shmoe')

      equal(m.attributes.fullName, undefined)
    })

    it('does not set actual attribute on model when setting virtual with object', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName: {
            get() {
              return this.get('firstName') + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))()
      m.set({ fullName: 'Jack Shmoe' })

      equal(m.attributes.fullName, undefined)
    })

    it('does not set virtual properties if no setter is specified', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName() {
            return this.get('firstName') + ' ' + this.get('lastName')
          }
        }
      }))()
      m.set('fullName', 'John Doe')

      equal(m.get('firstName'), undefined)
      equal(m.get('lastName'), undefined)
      equal(m.attributes.fullName, undefined)
    })

    it('does not crash when no virtuals are set', function () {
      const m = new (bookshelf.Model.extend())()
      m.set('firstName', 'Joe')
      equal(m.get('firstName'), 'Joe')
    })

    it('does nothing if not passing a key name', function () {
      const m = new (bookshelf.Model.extend())()
      m.set()
      deepEqual(m.attributes, {})
    })
  })

  describe('Model#toJSON()', function () {
    it('includes virtuals by default', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName() {
            return this.get('firstName') + ' ' + this.get('lastName')
          },
          fullNameWithGetSet: {
            get() {
              return this.get('firstName') + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })
      const json = m.toJSON()

      deepEqual(Object.keys(json), ['firstName', 'lastName', 'fullName', 'fullNameWithGetSet'])
    })

    it('includes virtuals if `outputVirtuals` is true', function () {
      const m = new (bookshelf.Model.extend({
        outputVirtuals: true,
        virtuals: {
          fullName() {
            return this.get('firstName') + ' ' + this.get('lastName')
          },
          fullNameWithGetSet: {
            get() {
              return this.get('firstName') + ' ' + this.get('lastName')
            },
            set(value) {
              value = value.split(' ')
              this.set('firstName', value[0])
              this.set('lastName', value[1])
            }
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })
      const json = m.toJSON()

      deepEqual(Object.keys(json), ['firstName', 'lastName', 'fullName', 'fullNameWithGetSet'])
    })

    it("doesn't include virtuals if `outputVirtuals` is set to false", function () {
      const m = new (bookshelf.Model.extend({
        outputVirtuals: false,
        virtuals: {
          fullName() {
            return this.get('firstName') + ' ' + this.get('lastName')
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })
      const json = m.toJSON()

      deepEqual(Object.keys(json), ['firstName', 'lastName'])
    })

    it('includes virtuals if `outputVirtuals` is false but `virtuals: true` is set in the options', function () {
      const m = new (bookshelf.Model.extend({
        outputVirtuals: false,
        virtuals: {
          fullName() {
            return this.get('firstName') + ' ' + this.get('lastName')
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })
      const json = m.toJSON({ virtuals: true })

      deepEqual(Object.keys(json), ['firstName', 'lastName', 'fullName'])
    })

    it("doesn't include virtuals if `outputVirtuals` is true but `virtuals: false` is set in the options", function () {
      const m = new (bookshelf.Model.extend({
        outputVirtuals: true,
        virtuals: {
          fullName() {
            return this.get('firstName') + ' ' + this.get('lastName')
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })
      const json = m.toJSON({ virtuals: false })

      deepEqual(Object.keys(json), ['firstName', 'lastName'])
    })

    it("doesn't include virtuals if `omitNew` is true even if `outputVirtuals` is true", function () {
      const m = new (bookshelf.Model.extend({
        outputVirtuals: true,
        virtuals: {
          fullName() {
            return this.get('firstName') + ' ' + this.get('lastName')
          }
        }
      }))({ firstName: 'Joe', lastName: 'Schmoe' })
      const json = m.toJSON({ omitNew: true })

      deepEqual(json, null)
    })

    it('includes virtuals with parameters', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName(param) {
            return this.get('firstName') + ' ' + param
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })
      const json = m.toJSON({ virtualParams: { fullName: 'Danger' } })

      deepEqual(Object.keys(json), ['firstName', 'lastName', 'fullName'])
      equal(json.fullName, 'Joe Danger')
    })

    it('includes virtuals with array parameters', function () {
      const m = new (bookshelf.Model.extend({
        virtuals: {
          fullName(param) {
            return this.get('firstName') + ' ' + param.join(' ')
          }
        }
      }))({ firstName: 'Joe', lastName: 'Shmoe' })
      const json = m.toJSON({
        virtualParams: { fullName: ['Danger', 'Mouse', 'Explosion'] }
      })

      equal(json.fullName, 'Joe Danger Mouse Explosion')
    })
  })

  describe('behaves correctly during a `patch` save', function () {
    const generalExpect = function (result) {
      equal(result.get('site_id'), 2)
      equal(result.get('first_name'), 'Oderus')
      equal(result.get('last_name'), 'Urungus')
    }

    it('by using the `{key: value}` style assignment call', function () {
      const Model = bookshelf.Model.extend({
        tableName: 'authors',
        virtuals: {
          full_name: {
            set(fullName) {
              const names = fullName.split(' ')
              return this.set({
                first_name: names[0],
                last_name: names[1]
              })
            },
            get() {
              return [this.get('first_name'), this.get('last_name')].join(' ')
            }
          }
        }
      })

      return new Model({ site_id: 5 })
        .save()
        .then((model) => {
          return model.save({ site_id: 2, full_name: 'Oderus Urungus' }, { patch: true })
        })
        .tap(generalExpect)
        .then((result) => result.refresh())
        .tap(generalExpect)
    })

    it('by using the `"key", value` style assignment call', function () {
      const Model = bookshelf.Model.extend({
        tableName: 'authors',
        virtuals: {
          full_name: {
            set(fullName) {
              const names = fullName.split(' ')
              this.set('first_name', names[0])
              this.set('last_name', names[1])
              return this.get('full_name')
            },
            get() {
              return [this.get('first_name'), this.get('last_name')].join(' ')
            }
          }
        }
      })

      return new Model({ site_id: 5 })
        .save()
        .then((model) => {
          return model.save({ site_id: 2, full_name: 'Oderus Urungus' }, { patch: true })
        })
        .tap(generalExpect)
        .then((result) => result.refresh())
        .tap(generalExpect)
    })
  })
})
