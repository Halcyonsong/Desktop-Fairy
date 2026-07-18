import type { PetDefinition } from '@/types/pet';

function buildPetUrl(pathname: string) {
  return new URL(pathname.replace(/^\/+/, ''), window.location.href).href;
}

function buildPetJsonUrl(petId: string) {
  return buildPetUrl(`pets/${petId}/pet.json`);
}

function buildPetAssetUrl(petId: string, relativePath: string) {
  if (/^(https?:)?\/\//i.test(relativePath) || relativePath.startsWith('file:') || relativePath.startsWith('data:')) {
    return relativePath;
  }

  return buildPetUrl(`pets/${petId}/${relativePath.replace(/^\.\//, '')}`);
}

export async function loadPetDefinition(petId: string) {
  const response = await fetch(buildPetJsonUrl(petId));
  if (!response.ok) {
    throw new Error(`无法读取精灵配置：${response.status}`);
  }

  const petDefinition = (await response.json()) as PetDefinition;
  return {
    ...petDefinition,
    spritesheetPath: buildPetAssetUrl(petId, petDefinition.spritesheetPath),
  } satisfies PetDefinition;
}
