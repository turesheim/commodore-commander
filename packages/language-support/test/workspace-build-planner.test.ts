import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  createKickAssemblerInvocation,
  loadKickAssemblerBuildConfiguration,
  parseKickAssemblerBuildConfiguration,
  resolveKickAssemblerBuildConfiguration
} from '../src/build/kick-assembler-build-configuration.ts';
import { KickAssemblerWorkspaceBuildPlanner } from '../src/build/workspace-build-planner.ts';

const workspaceRootPath = fileURLToPath(
  new URL('./fixtures/project', import.meta.url)
);
const mainPath = fileURLToPath(
  new URL('./fixtures/project/main.asm', import.meta.url)
);
const sharedPath = fileURLToPath(
  new URL('./fixtures/project/lib/shared.asm', import.meta.url)
);
const conditionalPath = fileURLToPath(
  new URL('./fixtures/project/lib/conditional.asm', import.meta.url)
);
const macrosPath = fileURLToPath(
  new URL('./fixtures/include-root/vendor/macros.asm', import.meta.url)
);

test('KickAssemblerWorkspaceBuildPlanner identifies standalone build programs', async () => {
  const planner = new KickAssemblerWorkspaceBuildPlanner();
  const plan = await planner.planWorkspaceBuild(workspaceRootPath);

  assert.deepEqual(plan.sourcePaths, [conditionalPath, sharedPath, mainPath]);
  assert.deepEqual(
    plan.programs.map((program) => program.entryPath),
    [mainPath]
  );
  assert.deepEqual(
    plan.programs[0]?.dependencyPaths,
    [
      fileURLToPath(
        new URL('./fixtures/project/lib/conditional.asm', import.meta.url)
      ),
      sharedPath
    ]
  );
});

test('KickAssemblerWorkspaceBuildPlanner applies configured programs, profiles, libraries, and generated assets', async () => {
  const configuration = resolveKickAssemblerBuildConfiguration(
    workspaceRootPath,
    {
      javaRuntime: './tools/java',
      javaArgs: ['-Xmx256m'],
      kickAssemblerJar: './tools/KickAss.jar',
      libraryRoots: ['../include-root'],
      outputFolder: 'build/default',
      runProgram: 'build/default/main.prg',
      generatedAssets: ['generated/shared'],
      profiles: {
        release: {
          outputFolder: 'build/release',
          runProgram: 'build/release/main-release.prg',
          debugDump: false,
          symbolFile: false,
          assemblerArgs: ['-define', 'RELEASE']
        }
      },
      programs: [
        {
          name: 'main-release',
          root: 'main.asm',
          machine: {
            profile: 'c64',
            model: 'c64c',
            viceArgs: ['-pal']
          },
          profile: 'release',
          generatedAssets: ['generated/main']
        }
      ]
    },
    {
      environment: {}
    }
  );
  const planner = new KickAssemblerWorkspaceBuildPlanner();
  const plan = await planner.planWorkspaceBuild(workspaceRootPath, macrosPath, {
    configuration
  });
  const program = plan.programs.find((entry) => entry.name === 'main-release');

  assert.equal(program?.name, 'main-release');
  assert.equal(program?.profileName, 'release');
  assert.deepEqual(program?.machine, {
    profile: 'c64',
    model: 'c64c',
    viceArgs: ['-pal']
  });
  assert.equal(program?.javaRuntime, path.join(workspaceRootPath, 'tools/java'));
  assert.equal(
    program?.kickAssemblerJar,
    path.join(workspaceRootPath, 'tools/KickAss.jar')
  );
  assert.deepEqual(program?.javaArgs, ['-Xmx256m']);
  assert.deepEqual(program?.libraryRootPaths, [
    fileURLToPath(new URL('./fixtures/include-root', import.meta.url))
  ]);
  assert.equal(
    program?.outputDirectoryPath,
    path.join(workspaceRootPath, 'build/release')
  );
  assert.equal(
    program?.runProgramPath,
    path.join(workspaceRootPath, 'build/release/main-release.prg')
  );
  assert.deepEqual(program?.dependencyPaths, [
    macrosPath,
    conditionalPath,
    sharedPath
  ]);
  assert.equal(program?.debugDump, false);
  assert.equal(program?.symbolFile, false);
  assert.deepEqual(program?.assemblerArgs, ['-define', 'RELEASE']);
  assert.deepEqual(program?.generatedAssetPaths, [
    path.join(workspaceRootPath, 'generated/shared'),
    path.join(workspaceRootPath, 'generated/main')
  ]);
  assert.deepEqual(
    plan.affectedPrograms.map((entry) => entry.name),
    ['main-release']
  );
});

test('KickAssemblerWorkspaceBuildPlanner treats output changes as ignored and generated asset changes as program changes', async () => {
  const configuration = resolveKickAssemblerBuildConfiguration(
    workspaceRootPath,
    {
      kickAssemblerJar: './tools/KickAss.jar',
      outputFolder: 'build/out',
      programs: [
        {
          name: 'main',
          root: 'main.asm',
          generatedAssets: ['generated/main']
        }
      ]
    },
    {
      environment: {}
    }
  );
  const planner = new KickAssemblerWorkspaceBuildPlanner();

  const outputPlan = await planner.planWorkspaceBuild(
    workspaceRootPath,
    path.join(workspaceRootPath, 'build/out/generated.asm'),
    { configuration }
  );
  assert.deepEqual(outputPlan.affectedPrograms, []);

  const generatedPlan = await planner.planWorkspaceBuild(
    workspaceRootPath,
    path.join(workspaceRootPath, 'generated/main/sprites.asm'),
    { configuration }
  );
  assert.deepEqual(
    generatedPlan.affectedPrograms.map((program) => program.name),
    ['main']
  );
});

test('KickAssemblerWorkspaceBuildPlanner keeps discovered standalone programs beside configured programs', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'commodore-commander-program-discovery-')
  );

  try {
    await mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await writeFile(
      path.join(temporaryRoot, 'main.asm'),
      '#import "lib/shared.asm"\nEntry:\n    rts\n'
    );
    await writeFile(
      path.join(temporaryRoot, 'lib', 'shared.asm'),
      'Shared:\n    rts\n'
    );
    await writeFile(
      path.join(temporaryRoot, 'sprite-test.asm'),
      'Entry:\n    rts\n'
    );

    const configuration = resolveKickAssemblerBuildConfiguration(
      temporaryRoot,
      {
        kickAssemblerJar: './tools/KickAss.jar',
        programs: [
          {
            name: 'main',
            root: 'main.asm'
          }
        ]
      },
      {
        environment: {}
      }
    );
    const planner = new KickAssemblerWorkspaceBuildPlanner();
    const plan = await planner.planWorkspaceBuild(temporaryRoot, undefined, {
      configuration
    });

    assert.deepEqual(
      plan.programs.map((program) => program.name),
      ['main', 'sprite-test']
    );
    assert.deepEqual(
      plan.programs.map((program) => program.machine),
      [undefined, undefined]
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('loadKickAssemblerBuildConfiguration reads project config files and CI overrides', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'commodore-commander-build-config-')
  );

  try {
    await writeFile(
      path.join(temporaryRoot, 'commodore-commander.build.json'),
      JSON.stringify({
        kickAssemblerJar: 'tools/project-kickass.jar',
        defaultProfile: 'ci',
        profiles: {
          ci: {
            outputFolder: 'ci-out',
            assemblerArgs: ['-define', 'CI']
          }
        },
        programs: [
          {
            name: 'main',
            root: 'src/main.asm'
          }
        ]
      })
    );

    const configuration = await loadKickAssemblerBuildConfiguration(temporaryRoot, {
      environment: {
        COMMODORE_COMMANDER_KICKASS_JAR: '/opt/kickass/KickAss.jar',
        COMMODORE_COMMANDER_JAVA_RUNTIME: '/opt/jdk/bin/java'
      }
    });

    assert.equal(
      configuration.configPath,
      path.join(temporaryRoot, 'commodore-commander.build.json')
    );
    assert.equal(configuration.defaultProfileName, 'ci');
    assert.equal(configuration.programs[0]?.machine, undefined);
    assert.equal(configuration.programs[0]?.kickAssemblerJar, '/opt/kickass/KickAss.jar');
    assert.equal(configuration.programs[0]?.javaRuntime, '/opt/jdk/bin/java');
    assert.equal(
      configuration.programs[0]?.outputDirectoryPath,
      path.join(temporaryRoot, 'ci-out')
    );
    assert.deepEqual(configuration.programs[0]?.assemblerArgs, ['-define', 'CI']);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('loadKickAssemblerBuildConfiguration resolves named run entries', () => {
  const configuration = resolveKickAssemblerBuildConfiguration(
    workspaceRootPath,
    {
      defaultProfile: 'debug',
      defaultRun: 'main-fast',
      profiles: {
        debug: {
          outputFolder: 'out/debug'
        }
      },
      programs: [
        {
          name: 'main',
          root: 'main.asm'
        }
      ],
      runs: [
        {
          name: 'main-fast',
          program: 'main',
          machine: {
            profile: 'c128',
            model: 'c128dcr'
          },
          runProgram: 'out/debug/main.prg',
          build: 'never'
        }
      ]
    },
    {
      environment: {}
    }
  );

  assert.equal(configuration.defaultRunName, 'main-fast');
  assert.deepEqual(configuration.runs, [
    {
      name: 'main-fast',
      programName: 'main',
      profileName: 'debug',
      machine: {
        profile: 'c128',
        model: 'c128dcr'
      },
      runProgramPath: path.join(workspaceRootPath, 'out/debug/main.prg'),
      build: 'never'
    }
  ]);
});

test('parseKickAssemblerBuildConfiguration rejects old target/variant config keys', () => {
  assert.throws(
    () =>
      parseKickAssemblerBuildConfiguration(
        JSON.stringify({
          defaultVariant: 'debug',
          variants: {
            debug: {}
          },
          targets: [
            {
              name: 'main',
              root: 'main.asm',
              variant: 'debug'
            }
          ]
        })
      ),
    /unsupported build configuration key\(s\): defaultVariant, targets, variants/u
  );

  assert.throws(
    () =>
      parseKickAssemblerBuildConfiguration(
        JSON.stringify({
          programs: [
            {
              name: 'main',
              path: 'main.asm',
              variant: 'debug'
            }
          ]
        })
      ),
    /programs\[0\] uses unsupported build configuration key\(s\): path, variant/u
  );

  assert.throws(
    () =>
      parseKickAssemblerBuildConfiguration(
        JSON.stringify({
          runs: [
            {
              name: 'main',
              program: 'main',
              variant: 'debug'
            }
          ]
        })
      ),
    /runs\[0\] uses unsupported build configuration key\(s\): variant/u
  );
});

test('parseKickAssemblerBuildConfiguration accepts default program machines', () => {
  const configuration = parseKickAssemblerBuildConfiguration(
    JSON.stringify({
      programs: [
        {
          name: 'main',
          root: 'main.asm'
        }
      ]
    })
  );

  assert.equal(configuration.programs?.[0]?.machine, undefined);
});

test('parseKickAssemblerBuildConfiguration rejects invalid machine sections', () => {
  assert.throws(
    () =>
      parseKickAssemblerBuildConfiguration(
        JSON.stringify({
          programs: [
            {
              name: 'main',
              root: 'main.asm',
              machine: 'c64'
            }
          ]
        })
      ),
    /programs\[0\]\.machine must be an object/u
  );

  assert.throws(
    () =>
      resolveKickAssemblerBuildConfiguration(
        workspaceRootPath,
        {
          programs: [
            {
              name: 'main',
              root: 'main.asm',
              machine: {
                profile: 'c64',
                model: 'c128dcr'
              }
            }
          ]
        },
        {
          environment: {}
        }
      ),
    /program main\.machine\.model references unsupported VICE model "c128dcr" for machine profile "c64"/u
  );
});

test('createKickAssemblerInvocation renders configured KickAss command lines', () => {
  const configuration = resolveKickAssemblerBuildConfiguration(
    workspaceRootPath,
    {
      javaRuntime: 'java',
      javaArgs: ['-Xmx512m'],
      kickAssemblerJar: 'tools/KickAss.jar',
      libraryRoots: ['library', 'vendor'],
      outputFolder: 'out',
      symbolFileFolder: 'symbols',
      debug: true,
      assemblerArgs: ['-define', 'FEATURE_ENABLED']
    },
    {
      environment: {}
    }
  );
  const program = {
    ...configuration.defaults,
    name: 'main',
    entryPath: mainPath
  };
  const invocation = createKickAssemblerInvocation(program);

  assert.equal(invocation.command, 'java');
  assert.deepEqual(invocation.args, [
    '-Xmx512m',
    '-jar',
    path.join(workspaceRootPath, 'tools/KickAss.jar'),
    '-libdir',
    path.join(workspaceRootPath, 'library'),
    '-libdir',
    path.join(workspaceRootPath, 'vendor'),
    mainPath,
    '-odir',
    path.join(workspaceRootPath, 'out'),
    '-showmem',
    '-debug',
    '-vicesymbols',
    '-debugdump',
    '-symbolfile',
    '-symbolfiledir',
    path.join(workspaceRootPath, 'symbols'),
    '-define',
    'FEATURE_ENABLED'
  ]);
});

test('KickAssemblerWorkspaceBuildPlanner limits affected programs to owning roots', async () => {
  const planner = new KickAssemblerWorkspaceBuildPlanner();
  const plan = await planner.planWorkspaceBuild(workspaceRootPath, sharedPath);

  assert.deepEqual(
    plan.affectedPrograms.map((program) => program.entryPath),
    [mainPath]
  );
});
