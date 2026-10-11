ALTER TABLE documents ADD COLUMN article_id uuid;
ALTER TABLE documents ADD CONSTRAINT document_article FOREIGN KEY(tenant_id,article_id) REFERENCES articles(tenant_id,id) ON DELETE SET NULL (article_id);
