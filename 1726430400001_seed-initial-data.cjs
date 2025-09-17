// DOSYA ADI: migrations/1726430400001_seed-initial-data.js

/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    console.log("Seeding initial roles and permissions...");

    // Temel Rolleri Ekle
    pgm.sql(`
        INSERT INTO roles (id, name, description) VALUES
        (1, 'Admin', 'Kiracı üzerindeki tüm izinlere sahip yönetici.'),
        (2, 'Developer', 'API anahtarlarını yönetebilir ve API''yi kullanabilir.'),
        (3, 'Viewer', 'Sadece kullanım verilerini ve paneli görüntüleyebilir.');
    `);

    // Temel İzinleri Ekle
    pgm.sql(`
        INSERT INTO permissions (id, name, description) VALUES
        (100, 'tenant:edit', 'Kiracı ayarlarını düzenleme.'),
        (200, 'keys:manage', 'API anahtarlarını oluşturma ve silme.'),
        (300, 'billing:manage', 'Abonelik ve fatura bilgilerini yönetme.'),
        (400, 'api:read', 'API''nin okuma (GET) endpoint''lerini kullanma.'),
        (500, 'api:write', 'API''nin yazma (POST, STAMP) endpoint''lerini kullanma.');
    `);

    // Rol-İzin Eşleştirmelerini Ekle
    pgm.sql(`
        INSERT INTO role_permissions (role_id, permission_id) VALUES
        -- Admin (Tüm İzinler)
        (1, 100), (1, 200), (1, 300), (1, 400), (1, 500),
        -- Developer (API ve Anahtar Yönetimi)
        (2, 200), (2, 400), (2, 500),
        -- Viewer (Sadece Okuma)
        (3, 400);
    `);

    console.log("Seeding complete.");
};

exports.down = pgm => {
    console.log("Reverting initial data seed...");
    pgm.sql("DELETE FROM role_permissions;");
    pgm.sql("DELETE FROM permissions;");
    pgm.sql("DELETE FROM roles;");
    console.log("Reverting seed complete.");
};