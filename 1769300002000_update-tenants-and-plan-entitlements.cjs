exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('plan_entitlements', {
    plan_id: { type: 'text', primaryKey: true },
    monthly_api_calls_total: { type: 'integer', notNull: true },
    endpoint_overrides: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  }, { ifNotExists: true });

  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'plan_entitlements_monthly_api_calls_total_check'
      ) THEN
        ALTER TABLE plan_entitlements
          ADD CONSTRAINT plan_entitlements_monthly_api_calls_total_check
          CHECK (monthly_api_calls_total >= 0);
      END IF;
    END;
    $$;
  `);

  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'plan'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'plan_id'
      ) THEN
        ALTER TABLE public.tenants RENAME COLUMN plan TO plan_id;
      END IF;
    END;
    $$;
  `);

  pgm.sql("ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'free';");
  pgm.sql('ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS quota_override jsonb;');
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE public.tenants DROP COLUMN IF EXISTS quota_override;');
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tenants'
          AND column_name = 'plan_id'
      ) THEN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenants'
            AND column_name = 'plan'
        ) THEN
          ALTER TABLE public.tenants DROP COLUMN plan_id;
        ELSE
          ALTER TABLE public.tenants RENAME COLUMN plan_id TO plan;
        END IF;
      END IF;
    END;
    $$;
  `);

  pgm.dropTable('plan_entitlements', { ifExists: true, cascade: true });
};
