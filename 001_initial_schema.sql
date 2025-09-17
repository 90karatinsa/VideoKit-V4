-- Gerekli UUID fonksiyonunu etkinleştirir
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roller tablosunu oluşturur
CREATE TABLE IF NOT EXISTS public.roles (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

-- Sistemin ihtiyaç duyduğu temel rolleri tabloya ekler
INSERT INTO public.roles (name) VALUES ('admin'), ('developer'), ('viewer') ON CONFLICT (name) DO NOTHING;

-- Şirketler/Müşteriler (tenants) tablosunu oluşturur
CREATE TABLE IF NOT EXISTS public.tenants (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free'
);

-- Kullanıcılar tablosunu oluşturur
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  full_name  TEXT,
  tenant_id  UUID NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Her kullanıcının geçerli bir tenanta bağlı olmasını sağlar
  CONSTRAINT fk_tenant
    FOREIGN KEY(tenant_id) 
	  REFERENCES public.tenants(id)
	  ON DELETE CASCADE
);