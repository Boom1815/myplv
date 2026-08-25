/**
 * Structure des fichiers KBO/BCE Open Data — confirmée par recoupement avec
 * le schéma d'un projet tiers open source construit sur ce jeu de données
 * (github.com/aerodynamica/KBOdatabase), cohérente avec la documentation
 * publique du SPF Économie (Cookbook KBO Open Data).
 *
 * ⚠️ Les noms de colonnes exacts (et les valeurs des colonnes codées comme
 * `Classification` ou `TypeOfAddress`, documentées dans code.csv) doivent
 * être vérifiés contre un export réel au premier import — voir le README
 * de ce paquet pour la procédure de validation.
 */

export type EnterpriseRow = {
  EnterpriseNumber: string;
  Status?: string;
  JuridicalSituation?: string;
  TypeOfEnterprise?: string;
  JuridicalForm?: string;
  JuridicalFormCAC?: string;
  StartDate?: string;
};

export type AddressRow = {
  EntityNumber: string;
  TypeOfAddress?: string;
  CountryFR?: string;
  CountryNL?: string;
  Zipcode?: string;
  MunicipalityFR?: string;
  MunicipalityNL?: string;
  StreetFR?: string;
  StreetNL?: string;
  HouseNumber?: string;
  Box?: string;
  ExtraAddressInfo?: string;
  DateStrikingOff?: string;
};

export type ActivityRow = {
  EntityNumber: string;
  ActivityGroup?: string;
  NaceVersion?: string;
  NaceCode: string;
  Classification?: string;
};

export type DenominationRow = {
  EntityNumber: string;
  Language?: string;
  TypeOfDenomination?: string;
  Denomination: string;
};

export type CodeRow = {
  Category: string;
  Code: string;
  Language?: string;
  Description: string;
};
