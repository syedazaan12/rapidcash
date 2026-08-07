const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'sqlite';
let sequelize;

if (process.env.DATABASE_URL) {
  const sslOptions = process.env.DB_SSL === 'false' ? {} : {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    }
  };
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: sslOptions,
  });
} else if (dialect === 'postgres' || dialect === 'postgresql') {
  const sslOptions = process.env.DB_SSL === 'false' ? {} : {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    }
  };
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      dialectOptions: sslOptions,
    }
  );
} else if (dialect === 'mysql') {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: false,
    }
  );
} else {
  const storage = process.env.DB_STORAGE || path.join(__dirname, '..', 'data', 'rapidcash.sqlite');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: false,
  });
}

module.exports = sequelize;

