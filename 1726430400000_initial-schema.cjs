/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  console.log("Creating initial database schema...");

  // UUID'ler için extension oluştur
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // Tenants (Kiracılar) Tablosu
  pgm.createTable('tenants', {
    id: { 
      type: 'uuid', 
      primaryKey: true, 
      default: pgm.func('gen_random_uuid()') 
    },
    name: { type: 'varchar(255)', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    }
  });
  console.log("  -> 'tenants' table created.");

  // Users (Kullanıcılar) Tablosu
  pgm.createTable('users', {
    id: { 
      type: 'uuid', 
      primaryKey: true, 
      default: pgm.func('gen_random_uuid()') 
    },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    full_name: { type: 'varchar(255)' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    }
  });
  console.log("  -> 'users' table created.");

  // Roles (Roller) Tablosu
  pgm.createTable('roles', {
    id: 'id', // Otomatik artan integer primary key
    name: { type: 'varchar(50)', notNull: true, unique: true }, // admin, developer, viewer
    description: { type: 'text' }
  });
  console.log("  -> 'roles' table created.");

  // Permissions (İzinler) Tablosu
  pgm.createTable('permissions', {
    id: 'id',
    name: { type: 'varchar(100)', notNull: true, unique: true }, // verify:create, stamp:create, tenant:edit
    description: { type: 'text' }
  });
  console.log("  -> 'permissions' table created.");

// Role_Permissions (Rol ve İzinleri Eşleştirme) Tablosu
pgm.createTable('role_permissions', {
  role_id: {
    type: 'integer',
    notNull: true,
    references: '"roles"',
    onDelete: 'cascade',
  },
  permission_id: {
    type: 'integer',
    notNull: true,
    references: '"permissions"',
    onDelete: 'cascade',
  },
});
// Birleşik primary key'i bu şekilde ekliyoruz
pgm.addConstraint('role_permissions', 'role_permissions_pkey', {
  primaryKey: ['role_id', 'permission_id']
});
  console.log("  -> 'role_permissions' table created.");

// User_Tenant_Roles (Kullanıcı, Kiracı ve Rolleri Eşleştirme) Tablosu
pgm.createTable('user_tenant_roles', {
  user_id: {
    type: 'uuid',
    notNull: true,
    references: '"users"',
    onDelete: 'cascade',
  },
  tenant_id: {
    type: 'uuid',
    notNull: true,
    references: '"tenants"',
    onDelete: 'cascade',
  },
  role_id: {
    type: 'integer',
    notNull: true,
    references: '"roles"',
    onDelete: 'cascade',
  },
});
// Birleşik primary key'i bu şekilde ekliyoruz
pgm.addConstraint('user_tenant_roles', 'user_tenant_roles_pkey', {
  primaryKey: ['user_id', 'tenant_id']
});
  console.log("  -> 'user_tenant_roles' table created.");
  console.log("Schema creation complete.");
};

exports.down = pgm => {
  console.log("Reverting initial database schema...");
  pgm.dropTable('user_tenant_roles');
  console.log("  -> 'user_tenant_roles' table dropped.");
  pgm.dropTable('role_permissions');
  console.log("  -> 'role_permissions' table dropped.");
  pgm.dropTable('permissions');
  console.log("  -> 'permissions' table dropped.");
  pgm.dropTable('roles');
  console.log("  -> 'roles' table dropped.");
  pgm.dropTable('users');
  console.log("  -> 'users' table dropped.");
  pgm.dropTable('tenants');
  console.log("  -> 'tenants' table dropped.");
  console.log("Schema reversion complete.");
};