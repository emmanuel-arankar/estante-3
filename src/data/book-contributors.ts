import contributorData from './book-contributors.json';

export interface ContributorRole {
  id: string;
  name: string;
}

export const getContributorRoles = (): ContributorRole[] => {
  return contributorData.roles;
};

export const getContributorRoleName = (id: string): string => {
  const role = contributorData.roles.find(r => r.id === id);
  return role ? role.name : id;
};
