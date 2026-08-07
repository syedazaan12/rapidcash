-- RapidCash MySQL Database Schema
-- Designed for phpMyAdmin / Hostinger MySQL Databases
-- Casing matches Sequelize ORM model expectations exactly

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table structure for table `users`
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `passwordHash` VARCHAR(255) NOT NULL,
  `role` ENUM('applicant', 'loan_officer', 'underwriter', 'admin') NOT NULL DEFAULT 'applicant',
  `firstName` VARCHAR(255) DEFAULT NULL,
  `lastName` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(255) DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `twoFactorEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `lastLoginAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table structure for table `applications`
CREATE TABLE IF NOT EXISTS `applications` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `status` ENUM('received', 'verification', 'processing', 'underwriting', 'additional_documents_required', 'decision_pending', 'approved', 'declined', 'funded', 'closed') NOT NULL DEFAULT 'received',
  `firstName` VARCHAR(255) DEFAULT NULL,
  `middleName` VARCHAR(255) DEFAULT NULL,
  `lastName` VARCHAR(255) DEFAULT NULL,
  `dateOfBirth` DATE DEFAULT NULL,
  `ssnEncrypted` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(255) DEFAULT NULL,
  `driverLicenseNumber` VARCHAR(255) DEFAULT NULL,
  `driverLicenseState` VARCHAR(255) DEFAULT NULL,
  `maritalStatus` VARCHAR(255) DEFAULT NULL,
  `citizenshipStatus` VARCHAR(255) DEFAULT NULL,
  `street` VARCHAR(255) DEFAULT NULL,
  `apartment` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(255) DEFAULT NULL,
  `state` VARCHAR(255) DEFAULT NULL,
  `zip` VARCHAR(255) DEFAULT NULL,
  `residenceType` VARCHAR(255) DEFAULT NULL,
  `yearsAtAddress` FLOAT DEFAULT NULL,
  `monthlyHousingPayment` FLOAT DEFAULT NULL,
  `employerName` VARCHAR(255) DEFAULT NULL,
  `employerPhone` VARCHAR(255) DEFAULT NULL,
  `occupation` VARCHAR(255) DEFAULT NULL,
  `employmentStatus` VARCHAR(255) DEFAULT NULL,
  `monthlyIncome` FLOAT DEFAULT NULL,
  `additionalIncome` FLOAT DEFAULT NULL,
  `yearsEmployed` FLOAT DEFAULT NULL,
  `payFrequency` VARCHAR(255) DEFAULT NULL,
  `bankName` VARCHAR(255) DEFAULT NULL,
  `routingNumberEncrypted` VARCHAR(255) DEFAULT NULL,
  `accountNumberEncrypted` VARCHAR(255) DEFAULT NULL,
  `accountType` VARCHAR(255) DEFAULT NULL,
  `directDepositConsent` TINYINT(1) DEFAULT NULL,
  `requestedAmount` FLOAT DEFAULT NULL,
  `purpose` VARCHAR(255) DEFAULT NULL,
  `preferredTermMonths` INTEGER DEFAULT NULL,
  `additionalComments` TEXT DEFAULT NULL,
  `riskScore` FLOAT DEFAULT NULL,
  `assignedUnderwriterId` CHAR(36) DEFAULT NULL,
  `internalNotes` TEXT DEFAULT NULL,
  `submittedAt` DATETIME DEFAULT NULL,
  `decisionAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table structure for table `documents`
CREATE TABLE IF NOT EXISTS `documents` (
  `id` CHAR(36) NOT NULL,
  `applicationId` CHAR(36) NOT NULL,
  `type` ENUM('government_id', 'bank_statement', 'pay_stub', 'tax_return', 'w2', '1099', 'credit_report', 'proof_of_address', 'other') NOT NULL,
  `originalFilename` VARCHAR(255) DEFAULT NULL,
  `storagePath` VARCHAR(255) DEFAULT NULL,
  `mimeType` VARCHAR(255) DEFAULT NULL,
  `sizeBytes` INTEGER DEFAULT NULL,
  `status` ENUM('pending_review', 'accepted', 'rejected') NOT NULL DEFAULT 'pending_review',
  `uploadedAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`applicationId`) REFERENCES `applications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Table structure for table `audit_logs`
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` CHAR(36) NOT NULL,
  `actorUserId` CHAR(36) DEFAULT NULL,
  `action` VARCHAR(255) DEFAULT NULL,
  `targetType` VARCHAR(255) DEFAULT NULL,
  `targetId` CHAR(36) DEFAULT NULL,
  `ipAddress` VARCHAR(255) DEFAULT NULL,
  `metadata` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Table structure for table `contact_messages`
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` CHAR(36) NOT NULL,
  `firstName` VARCHAR(255) DEFAULT NULL,
  `lastName` VARCHAR(255) DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(255) DEFAULT NULL,
  `topic` VARCHAR(255) DEFAULT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('new', 'in_progress', 'resolved') NOT NULL DEFAULT 'new',
  `ipAddress` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- 6. Seed default portal logins
-- Insert admin user (email: admin@rapidcash.credit, password: qwe123)
INSERT INTO `users` (
  `id`, 
  `email`, 
  `passwordHash`, 
  `role`, 
  `firstName`, 
  `lastName`, 
  `isActive`, 
  `twoFactorEnabled`, 
  `createdAt`, 
  `updatedAt`
) VALUES (
  '1666f7d2-40b7-4eb9-a378-71292050c190', 
  'admin@rapidcash.credit', 
  '$2a$12$5cgz1nfBFiZfjyUkxlRB6.uHipiRIE938M2zbg0g88oXSks/Zs.7.', 
  'admin', 
  'System', 
  'Administrator', 
  1, 
  0, 
  UTC_TIMESTAMP(), 
  UTC_TIMESTAMP()
) ON DUPLICATE KEY UPDATE 
  `passwordHash` = VALUES(`passwordHash`),
  `role` = VALUES(`role`),
  `isActive` = VALUES(`isActive`),
  `updatedAt` = UTC_TIMESTAMP();

-- Insert reviewer user (email: reviewer@rapidcash.credit, password: qwe123)
INSERT INTO `users` (
  `id`, 
  `email`, 
  `passwordHash`, 
  `role`, 
  `firstName`, 
  `lastName`, 
  `isActive`, 
  `twoFactorEnabled`, 
  `createdAt`, 
  `updatedAt`
) VALUES (
  '594b0741-a8e5-4782-95cd-17442143c2c9', 
  'reviewer@rapidcash.credit', 
  '$2a$12$5cgz1nfBFiZfjyUkxlRB6.uHipiRIE938M2zbg0g88oXSks/Zs.7.', 
  'underwriter', 
  'Portal', 
  'Reviewer', 
  1, 
  0, 
  UTC_TIMESTAMP(), 
  UTC_TIMESTAMP()
) ON DUPLICATE KEY UPDATE 
  `passwordHash` = VALUES(`passwordHash`),
  `role` = VALUES(`role`),
  `isActive` = VALUES(`isActive`),
  `updatedAt` = UTC_TIMESTAMP();
