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

test('SIDScore modules resolve to program inputs and trigger assembly on score changes', async () => {
  const sourcePath = path.join(workspaceRootPath, 'music/theme.sidscore');
  const parsed = parseKickAssemblerBuildConfiguration(JSON.stringify({
    programs: [{
      name: 'main',
      root: 'main.asm',
      sidScoreModules: [{
        source: 'music/theme.sidscore',
        namespace: 'Music',
        origin: '$3000'
      }]
    }]
  }));
  const configuration = resolveKickAssemblerBuildConfiguration(
    workspaceRootPath,
    parsed,
    { environment: {} }
  );
  const plan = await new KickAssemblerWorkspaceBuildPlanner().planWorkspaceBuild(
    workspaceRootPath,
    sourcePath,
    { configuration }
  );

  assert.deepEqual(plan.affectedPrograms.map((program) => program.name), ['main']);
  assert.deepEqual(plan.affectedPrograms[0]?.sidScoreModules, [{
    sourcePath,
    namespace: 'Music',
    origin: 0x3000
  }]);
  assert.ok(plan.affectedPrograms[0]?.generatedAssetPaths.includes(sourcePath));
});

test('imported SIDScore subtunes and effects trigger their owning program build', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'commodore-commander-sidscore-imports-')
  );
  try {
    const musicDirectory = path.join(temporaryRoot, 'music');
    const effectPath = path.join(musicDirectory, 'effect.sidscore');
    await mkdir(musicDirectory, { recursive: true });
    await writeFile(path.join(temporaryRoot, 'game.asm'), '*=$2000\nstart: rts\n');
    await writeFile(
      path.join(musicDirectory, 'theme.sidscore'),
      'IMPORT "effect.sidscore" ; note\n  AS 2\n; IMPORT "ignored.sidscore" AS 3\n'
    );
    await writeFile(effectPath, 'EFFECT Zap { VOICE 3 LENGTH 4 TICKS }\n');
    const configuration = resolveKickAssemblerBuildConfiguration(
      temporaryRoot,
      {
        programs: [{
          root: 'game.asm',
          sidScoreModules: [{
            source: 'music/theme.sidscore', namespace: 'Music', origin: '$3000'
          }]
        }]
      },
      { environment: {} }
    );
    const plan = await new KickAssemblerWorkspaceBuildPlanner().planWorkspaceBuild(
      temporaryRoot,
      effectPath,
      { configuration }
    );

    assert.deepEqual(plan.affectedPrograms.map((program) => program.name), ['game']);
    assert.ok(plan.affectedPrograms[0]?.generatedAssetPaths.includes(effectPath));
    assert.ok(!plan.affectedPrograms[0]?.generatedAssetPaths.includes(
      path.join(musicDirectory, 'ignored.sidscore')
    ));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('ASM SIDScore declarations work without module JSON in root and included files', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'commodore-commander-asm-sidscore-')
  );
  try {
    const gamePath = path.join(temporaryRoot, 'game.asm');
    const musicPath = path.join(temporaryRoot, 'music', 'theme.sidscore');
    const effectPath = path.join(temporaryRoot, 'music', 'zap.sidscore');
    const otherPath = path.join(temporaryRoot, 'music', 'other.sidscore');
    await mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await mkdir(path.join(temporaryRoot, 'music'), { recursive: true });
    await writeFile(gamePath, [
      '// @sidscore "music/theme.sidscore" as Music at $3000',
      '#import "lib/effects.asm"',
      'start: rts'
    ].join('\n'));
    await writeFile(
      path.join(temporaryRoot, 'unrelated.asm'),
      '*=$2000\nstart: rts\n'
    );
    await writeFile(path.join(temporaryRoot, 'lib', 'effects.asm'), [
      '  // @SIDScore "../music/other.sidscore" AS Other AT 0x4000',
      '  // // @sidscore "../music/ignored.sidscore" as Ignored at $5000'
    ].join('\n'));
    await writeFile(musicPath, 'IMPORT "zap.sidscore" AS 2\n');
    await writeFile(effectPath, 'EFFECT Zap { VOICE 3 LENGTH 4 TICKS }\n');
    await writeFile(otherPath, 'TUNE 1 { }\n');

    const plan = await new KickAssemblerWorkspaceBuildPlanner().planWorkspaceBuild(
      temporaryRoot, effectPath
    );
    assert.deepEqual(plan.programs.map((program) => program.name), [
      'game', 'unrelated'
    ]);
    assert.deepEqual(plan.affectedPrograms.map((program) => program.name), ['game']);
    assert.deepEqual(plan.programs[0]?.sidScoreModules, [
      { sourcePath: musicPath, namespace: 'Music', origin: 0x3000 },
      { sourcePath: otherPath, namespace: 'Other', origin: 0x4000 }
    ]);
    assert.ok(plan.programs[0]?.generatedAssetPaths.includes(musicPath));
    assert.ok(plan.programs[0]?.generatedAssetPaths.includes(effectPath));
    assert.ok(plan.programs[0]?.generatedAssetPaths.includes(otherPath));
    assert.ok(!plan.programs[0]?.generatedAssetPaths.includes(
      path.join(temporaryRoot, 'music', 'ignored.sidscore')
    ));
    const unrelatedScorePlan = await new KickAssemblerWorkspaceBuildPlanner()
      .planWorkspaceBuild(
        temporaryRoot,
        path.join(temporaryRoot, 'music', 'unrelated.sidscore')
      );
    assert.deepEqual(unrelatedScorePlan.affectedPrograms, []);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('ASM SIDScore declarations merge with configured modules and diagnose conflicts', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'commodore-commander-sidscore-conflicts-')
  );
  try {
    const gamePath = path.join(temporaryRoot, 'game.asm');
    const configuration = resolveKickAssemblerBuildConfiguration(
      temporaryRoot,
      { programs: [{ root: 'game.asm', sidScoreModules: [{
        source: 'music/legacy.sidscore', namespace: 'Legacy', origin: '$3000'
      }] }] },
      { environment: {} }
    );
    const planner = new KickAssemblerWorkspaceBuildPlanner();
    await writeFile(gamePath, '// @sidscore "music/new.sidscore" as New at 16384\n');
    const plan = await planner.planWorkspaceBuild(temporaryRoot, undefined, { configuration });
    assert.deepEqual(plan.programs[0]?.sidScoreModules, [
      {
        sourcePath: path.join(temporaryRoot, 'music', 'legacy.sidscore'),
        namespace: 'Legacy', origin: 0x3000
      },
      {
        sourcePath: path.join(temporaryRoot, 'music', 'new.sidscore'),
        namespace: 'New', origin: 0x4000
      }
    ]);

    await writeFile(gamePath, '\n// @sidscore "music/new.sidscore" as Legacy at $4000\n');
    await assert.rejects(
      planner.planWorkspaceBuild(temporaryRoot, undefined, { configuration }),
      (error) => error instanceof Error && error.message.includes(
        `${gamePath}:2: SIDScore namespace Legacy is already declared in build configuration`
      )
    );
    await writeFile(gamePath, '// @sidscore "music/new.sidscore" as New at $3000\n');
    await assert.rejects(
      planner.planWorkspaceBuild(temporaryRoot, undefined, { configuration }),
      (error) => error instanceof Error && error.message.includes(
        `${gamePath}:1: SIDScore origin $3000 is already declared in build configuration`
      )
    );
    await writeFile(gamePath, '// @sidscore "music/new.sidscore" as New\n');
    await assert.rejects(
      planner.planWorkspaceBuild(temporaryRoot, undefined, { configuration }),
      (error) => error instanceof Error && error.message.includes(
        `${gamePath}:1: invalid SIDScore declaration`
      )
    );
    await writeFile(gamePath, [
      '#if 0',
      '// @sidscore "music/new.sidscore" as New at $4000',
      '#endif'
    ].join('\n'));
    await assert.rejects(
      planner.planWorkspaceBuild(temporaryRoot, undefined, { configuration }),
      (error) => error instanceof Error && error.message.includes(
        `${gamePath}:2: SIDScore declarations must be unconditional`
      )
    );
    await writeFile(gamePath, [
      '/*',
      '// @sidscore "music/ignored.sidscore" as Ignored at $4000',
      '*/'
    ].join('\n'));
    const commentedPlan = await planner.planWorkspaceBuild(
      temporaryRoot, undefined, { configuration }
    );
    assert.deepEqual(commentedPlan.programs[0]?.sidScoreModules, [
      {
        sourcePath: path.join(temporaryRoot, 'music', 'legacy.sidscore'),
        namespace: 'Legacy', origin: 0x3000
      }
    ]);
    await writeFile(gamePath, [
      '// @sidscore "music/one.sidscore" as One at $4000',
      '// @sidscore "music/two.sidscore" as One at $5000'
    ].join('\n'));
    await assert.rejects(
      planner.planWorkspaceBuild(temporaryRoot, undefined, { configuration }),
      (error) => error instanceof Error && error.message.includes(
        `${gamePath}:2: SIDScore namespace One is already declared in ${gamePath}:1`
      )
    );
    await writeFile(gamePath, [
      '// @sidscore "music/one.sidscore" as One at $4000',
      '// @sidscore "music/two.sidscore" as Two at $4000'
    ].join('\n'));
    await assert.rejects(
      planner.planWorkspaceBuild(temporaryRoot, undefined, { configuration }),
      (error) => error instanceof Error && error.message.includes(
        `${gamePath}:2: SIDScore origin $4000 is already declared in ${gamePath}:1`
      )
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('SIDScore module configuration rejects invalid origin and namespace', () => {
  assert.throws(() => parseKickAssemblerBuildConfiguration(JSON.stringify({
    programs: [{ root: 'main.asm', sidScoreModules: [{
      source: 'music/theme.sidscore', namespace: 'Music', origin: '$10000'
    }] }]
  })), /origin must be between \$0000 and \$ffff/u);
  assert.throws(() => parseKickAssemblerBuildConfiguration(JSON.stringify({
    programs: [{ root: 'main.asm', sidScoreModules: [{
      source: 'music/theme.sidscore', namespace: 'bad-name', origin: '$3000'
    }] }]
  })), /namespace must be a Kick Assembler identifier/u);
  assert.throws(() => resolveKickAssemblerBuildConfiguration(workspaceRootPath, {
    programs: [{ root: 'main.asm', sidScoreModules: [
      { source: 'music/a.sidscore', namespace: 'A', origin: '$3000' },
      { source: 'music/b.sidscore', namespace: 'B', origin: '$3000' }
    ] }]
  }, { environment: {} }), /SIDScore origin \$3000 more than once/u);
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
