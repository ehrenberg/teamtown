// The package ships register-hooks.d.ts next to register-hooks.mjs, which `nodenext` resolution does not pick up.
declare module 'import-in-the-middle/register-hooks.mjs' {
  export interface RegisterHooksOptions {
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    disableCjsSourceStripping?: boolean;
  }
  export function register(options?: RegisterHooksOptions): void;
  export function supportsSyncHooks(): boolean;
}
