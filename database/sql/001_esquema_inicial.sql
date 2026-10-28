-- ============================================================
-- Semilla - Gestión Comunitaria
-- Esquema inicial PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. SEGURIDAD Y AUDITORÍA
-- ============================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(120) NOT NULL UNIQUE,
    module VARCHAR(80) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (expires_at > created_at)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. TERRITORIO, FAMILIAS Y NECESIDADES
-- ============================================================

CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    municipality VARCHAR(120),
    department VARCHAR(120),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (zone_id, name),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
    code VARCHAR(40) NOT NULL UNIQUE,
    household_name VARCHAR(180),
    address_reference TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    housing_condition VARCHAR(50),
    monthly_income NUMERIC(14,2) CHECK (monthly_income IS NULL OR monthly_income >= 0),
    observations TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_number VARCHAR(30) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    sex VARCHAR(20) CHECK (sex IS NULL OR sex IN ('FEMALE', 'MALE', 'OTHER', 'NOT_SPECIFIED')),
    phone VARCHAR(30),
    email VARCHAR(180),
    occupation VARCHAR(120),
    education_level VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
    relationship VARCHAR(80) NOT NULL,
    is_household_head BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at DATE,
    left_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (family_id, person_id),
    CHECK (left_at IS NULL OR joined_at IS NULL OR left_at >= joined_at)
);

CREATE TABLE need_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE family_needs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    need_type_id UUID NOT NULL REFERENCES need_types(id) ON DELETE RESTRICT,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'IDENTIFIED' CHECK (status IN ('IDENTIFIED', 'EVALUATING', 'APPROVED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')),
    identified_at DATE NOT NULL DEFAULT CURRENT_DATE,
    resolved_at DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (resolved_at IS NULL OR resolved_at >= identified_at)
);

-- ============================================================
-- 3. PROGRAMAS, POA, PROYECTOS Y ACTIVIDADES
-- ============================================================

CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL UNIQUE,
    description TEXT,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE strategic_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    fiscal_year SMALLINT NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2200),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (program_id, fiscal_year, code)
);

CREATE TABLE strategic_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    objective_id UUID NOT NULL REFERENCES strategic_objectives(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    target_value NUMERIC(14,2),
    target_unit VARCHAR(80),
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (target_value IS NULL OR target_value >= 0)
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
    strategic_goal_id UUID REFERENCES strategic_goals(id) ON DELETE SET NULL,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    project_type VARCHAR(80),
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'APPROVED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    start_date DATE,
    end_date DATE,
    planned_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (planned_cost >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'HNL',
    responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE project_communities (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, community_id)
);

CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    strategic_goal_id UUID REFERENCES strategic_goals(id) ON DELETE SET NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    planned_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (planned_cost >= 0),
    actual_cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (actual_cost >= 0),
    responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (planned_end_date IS NULL OR planned_start_date IS NULL OR planned_end_date >= planned_start_date),
    CHECK (actual_end_date IS NULL OR actual_start_date IS NULL OR actual_end_date >= actual_start_date)
);

CREATE TABLE activity_beneficiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    family_id UUID REFERENCES families(id) ON DELETE RESTRICT,
    person_id UUID REFERENCES persons(id) ON DELETE RESTRICT,
    beneficiary_type VARCHAR(20) NOT NULL CHECK (beneficiary_type IN ('FAMILY', 'PERSON')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (beneficiary_type = 'FAMILY' AND family_id IS NOT NULL AND person_id IS NULL)
        OR
        (beneficiary_type = 'PERSON' AND person_id IS NOT NULL AND family_id IS NULL)
    )
);

-- ============================================================
-- 4. DONACIONES Y RECURSOS
-- ============================================================

CREATE TABLE donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_type VARCHAR(30) NOT NULL CHECK (donor_type IN ('PERSON', 'ORGANIZATION', 'CHURCH', 'COMPANY', 'OTHER')),
    name VARCHAR(180) NOT NULL,
    contact_name VARCHAR(160),
    email VARCHAR(180),
    phone VARCHAR(30),
    country VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    donation_type VARCHAR(20) NOT NULL CHECK (donation_type IN ('CASH', 'IN_KIND', 'MIXED')),
    donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    cash_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cash_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    reference VARCHAR(120),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK ((donation_type = 'CASH' AND cash_amount > 0) OR donation_type IN ('IN_KIND', 'MIXED'))
);

CREATE TABLE resource_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES resource_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    unit_of_measure VARCHAR(50) NOT NULL,
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    minimum_stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE donation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unit_value >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. COMPRAS, PRESUPUESTO Y FINANZAS
-- ============================================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(180) NOT NULL,
    tax_id VARCHAR(40),
    contact_name VARCHAR(160),
    email VARCHAR(180),
    phone VARCHAR(30),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (tax_id)
);

CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    document_number VARCHAR(80),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED')),
    currency VARCHAR(3) NOT NULL DEFAULT 'HNL',
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (total_amount >= subtotal)
);

CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    fiscal_year SMALLINT NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2200),
    version_number SMALLINT NOT NULL DEFAULT 1 CHECK (version_number > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'CLOSED')),
    currency VARCHAR(3) NOT NULL DEFAULT 'HNL',
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, fiscal_year, version_number)
);

CREATE TABLE budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    planned_amount NUMERIC(14,2) NOT NULL CHECK (planned_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    budget_item_id UUID REFERENCES budget_items(id) ON DELETE SET NULL,
    purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'HNL',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'CANCELLED')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'HNL',
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER')),
    reference VARCHAR(120),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resource_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    donation_item_id UUID REFERENCES donation_items(id) ON DELETE SET NULL,
    purchase_item_id UUID REFERENCES purchase_items(id) ON DELETE SET NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ALLOCATION', 'RETURN', 'ADJUSTMENT')),
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

-- ============================================================
-- 6. EVIDENCIAS Y SINCRONIZACIÓN
-- ============================================================

CREATE TABLE evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
    family_id UUID REFERENCES families(id) ON DELETE SET NULL,
    person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
    evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN ('PHOTO', 'DOCUMENT', 'RECEIPT', 'VIDEO', 'OTHER')),
    title VARCHAR(180) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(120),
    captured_at TIMESTAMPTZ,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK (project_id IS NOT NULL OR activity_id IS NOT NULL OR family_id IS NOT NULL OR person_id IS NOT NULL),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE sync_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_uuid UUID NOT NULL,
    device_name VARCHAR(160),
    platform VARCHAR(80),
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_uuid)
);

CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES sync_devices(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(180) NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    request_path TEXT NOT NULL,
    request_hash VARCHAR(128),
    response_status INTEGER,
    response_body JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (idempotency_key),
    CHECK (expires_at > created_at)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_name, entity_id, created_at DESC);

CREATE INDEX idx_communities_zone_id ON communities(zone_id);
CREATE INDEX idx_families_community_id ON families(community_id);
CREATE INDEX idx_family_members_family_id ON family_members(family_id);
CREATE INDEX idx_family_members_person_id ON family_members(person_id);
CREATE INDEX idx_family_needs_family_id ON family_needs(family_id);
CREATE INDEX idx_family_needs_type_status ON family_needs(need_type_id, status);

CREATE INDEX idx_objectives_program_year ON strategic_objectives(program_id, fiscal_year);
CREATE INDEX idx_goals_objective_id ON strategic_goals(objective_id);
CREATE INDEX idx_projects_program_status ON projects(program_id, status);
CREATE INDEX idx_projects_goal_id ON projects(strategic_goal_id);
CREATE INDEX idx_project_communities_community_id ON project_communities(community_id);
CREATE INDEX idx_activities_project_status ON activities(project_id, status);
CREATE INDEX idx_activities_dates ON activities(planned_start_date, planned_end_date);
CREATE INDEX idx_activity_beneficiaries_activity ON activity_beneficiaries(activity_id);
CREATE INDEX idx_activity_beneficiaries_family ON activity_beneficiaries(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_activity_beneficiaries_person ON activity_beneficiaries(person_id) WHERE person_id IS NOT NULL;

CREATE INDEX idx_donations_donor_date ON donations(donor_id, donation_date DESC);
CREATE INDEX idx_donations_project_id ON donations(project_id);
CREATE INDEX idx_resources_category_id ON resources(category_id);
CREATE INDEX idx_donation_items_donation_id ON donation_items(donation_id);
CREATE INDEX idx_donation_items_resource_id ON donation_items(resource_id);

CREATE INDEX idx_purchases_supplier_date ON purchases(supplier_id, purchase_date DESC);
CREATE INDEX idx_purchases_project_id ON purchases(project_id);
CREATE INDEX idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_resource_id ON purchase_items(resource_id);
CREATE INDEX idx_budgets_project_year ON budgets(project_id, fiscal_year);
CREATE INDEX idx_budget_items_budget_id ON budget_items(budget_id);
CREATE INDEX idx_expenses_project_date ON expenses(project_id, expense_date DESC);
CREATE INDEX idx_expenses_budget_item_id ON expenses(budget_item_id);
CREATE INDEX idx_payments_expense_date ON payments(expense_id, payment_date DESC);
CREATE INDEX idx_resource_movements_resource_date ON resource_movements(resource_id, movement_date DESC);
CREATE INDEX idx_resource_movements_project_date ON resource_movements(project_id, movement_date DESC) WHERE project_id IS NOT NULL;

CREATE INDEX idx_evidences_project_id ON evidences(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_evidences_activity_id ON evidences(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX idx_evidences_family_id ON evidences(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_sync_devices_user_id ON sync_devices(user_id);
CREATE INDEX idx_idempotency_expires_at ON idempotency_keys(expires_at);

-- ============================================================
-- DATOS BASE MÍNIMOS
-- ============================================================

INSERT INTO roles (name, description) VALUES
    ('ADMINISTRADOR', 'Administración general del sistema'),
    ('COORDINADOR', 'Coordinación de programas y proyectos'),
    ('FINANZAS', 'Gestión financiera, presupuestos, gastos y pagos'),
    ('PERSONAL_CAMPO', 'Registro y seguimiento de información comunitaria'),
    ('VOLUNTARIO', 'Acceso limitado a actividades asignadas'),
    ('CONSULTA', 'Acceso de solo lectura');

INSERT INTO need_types (name, description) VALUES
    ('Vivienda', 'Necesidades relacionadas con construcción o mejora de vivienda'),
    ('Alimentación', 'Necesidades de provisiones o seguridad alimentaria'),
    ('Salud', 'Necesidades médicas, odontológicas o de atención sanitaria'),
    ('Educación', 'Necesidades educativas y de infraestructura escolar'),
    ('Infraestructura', 'Necesidades de infraestructura comunitaria'),
    ('Empleo e ingresos', 'Necesidades relacionadas con generación de ingresos');

INSERT INTO resource_categories (name, description) VALUES
    ('Materiales de construcción', 'Materiales utilizados en viviendas e infraestructura'),
    ('Alimentos', 'Provisiones y recursos alimentarios'),
    ('Medicamentos e insumos médicos', 'Medicamentos e insumos para brigadas y atención sanitaria'),
    ('Equipamiento', 'Equipos y herramientas'),
    ('Otros', 'Recursos no clasificados en categorías anteriores');
