-- Migration para adicionar tabela de registro temporário
CREATE TABLE `user_registrations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nickname` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `discord` VARCHAR(100) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `confirmation_token` VARCHAR(255) NOT NULL UNIQUE,
  `token_expires_at` DATETIME NOT NULL,
  `is_confirmed` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `confirmed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `user_registrations_email_idx` (`email`),
  INDEX `user_registrations_confirmation_token_idx` (`confirmation_token`),
  INDEX `user_registrations_created_at_idx` (`created_at`)
);
