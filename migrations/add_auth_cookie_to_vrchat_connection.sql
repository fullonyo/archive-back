-- Adiciona campo auth_cookie na tabela vrchat_connections
ALTER TABLE vrchat_connections 
ADD COLUMN auth_cookie TEXT DEFAULT NULL;

-- Adiciona comentário para documentar o campo
ALTER TABLE vrchat_connections 
MODIFY COLUMN auth_cookie TEXT COMMENT 'Cookie de autenticação do VRChat para API calls';
