const bcrypt = require('bcryptjs')

const SALT_ROUNDS = 10

const AuthService = {
  async hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS)
  },

  async verifyPassword(password, hash) {
    if (!hash || !hash.startsWith('$2')) return false
    return bcrypt.compare(password, hash)
  }
}

module.exports = AuthService
