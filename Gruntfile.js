/* jshint -W097 */
/* jshint camelcase: false */

'use strict';

var minifyify = require('minifyify');

module.exports = function (grunt) {
    // Project configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        default: {},
        meta: {},
        watch: {

            less: {
                options: {
                    livereload: '<%= connect.serve.options.livereload %>'
                },
                files: [
                    'css/**/*.less',
                    'themes/**/*.less',
                    'node_modules/amplience-sdk-client/css/main.less'
                ],
                tasks: ['build-css']
            },

            templates: {
                options: {
                    livereload: '<%= connect.serve.options.livereload %>'
                },
                files: [
                    'templates/**/*.hbs'
                ],
                tasks: ['build-js']
            },

            javascript: {
                options: {
                    livereload: '<%= connect.serve.options.livereload %>'
                },
                files: [
                    'src/**/*.js'
                ],
                tasks: ['build-js']
            },

            html: {
                options: {
                    livereload: '<%= connect.serve.options.livereload %>'
                },
                files: [
                    '*.html'
                ]
            }

        },

        connect: {
            options: {
                port: 9102,
                hostname: '0.0.0.0',
                base: '.',
                livereload: 35741,
                open: 'http://localhost:9102',
                debug: true
            },

            serve: {
                options: {
                    livereload: 35741
                }
            }
        },

        less: {
            options: {
                ieCompat: true,
                compress: true,
                yuicompress: true,
                optimization: 2
            },
            build: {
                files: {
                    'dist/amp-dfs-viewer.css': [
                        'node_modules/amplience-sdk-client/css/main.less',
                        'css/viewer.less'
                    ]
                }
            },

            //Take css for video from sdk, as it has custom styles applied
            buildVideo: {
                files: {
                    'dist/video-js-extracted-from-sdk.css': [
                        'node_modules/amplience-sdk-client/css/video.less'
                    ]
                }
            }
        },

        handlebars: {
            build: {

                options: {
                    namespace: 'amp.templates.dfs',
                    partialsUseNamespace: true,
                    processName: function (filePath) {
                        return filePath.replace(/^templates\//, '').replace(/\.hbs$/, '');
                    },
                    processPartialName: function (filePath) {
                        if (filePath.indexOf('icons') !== -1) {
                            var pieces = filePath.split('/');
                            var name = pieces[pieces.length - 1];
                            return filePath.replace(/.*/, 'icons' + name).replace(/\.hbs$/, '').replace(/_/, '-');
                        }
                        return filePath.replace(/^templates\//, '').replace(/\.hbs$/, '');
                    }
                },

                files: {
                    'src/templates/templates.compiled.js': 'templates/**/*.hbs'
                }
            }

        },

        browserify: {
            options: {
                browserifyOptions: {
                    debug: true
                },
                transform: ['strictify']
            },

            dist: {
                options: {
                    preBundleCB: function (b) {

                        b.plugin(minifyify,
                            {
                                output: './dist/amp-dfs-viewers.min.js.map',
                                map: 'amp-dfs-viewers.min.js.map'
                            });
                    }
                },

                files: {
                    'dist/amp-dfs-viewers.min.js': [
                        'src/viewer.js'
                    ]
                }
            },

            build: {
                files: {
                    'dist/amp-dfs-viewers.js': [
                        'src/viewer.js'
                    ]
                }
            }

        },

        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        file_append: {
            commonJs: {
                files: [
                    {
                        append: '\n\nmodule.exports = this["amp"]["templates"]["dfs"];',
                        input: 'src/templates/templates.compiled.js',
                        output: 'src/templates/templates.compiled.js'
                    }
                ]
            }
        },

        // Make sure code styles are up to par and there are no obvious mistakes
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: require('jshint-stylish')
            },
            all: {
                src: [
                    'Gruntfile.js',
                    'src/**/*.js',
                    '!src/**/*.compiled.js'
                ]
            }
        },

        jscs: {
            fix: {
                src: [
                    'Gruntfile.js',
                    'src/**/*.js',
                    '!src/**/*.compiled.js'
                ],
                options: {
                    config: '.jscsrc',
                    verbose: true,
                    fix: true
                }
            },
            check: {
                src: [
                    'Gruntfile.js',
                    'src/**/*.js',
                    '!src/**/*.compiled.js'
                ],
                options: {
                    config: '.jscsrc',
                    verbose: true,
                    fix: false
                }
            }
        },

        concat: {
            build: {
                files: {
                    'dist/amp-dfs-viewer-libs.js': [
                        'lib/jquery-ui-1.10.4.custom.min.js',
                        'node_modules/amplience-sdk-client/dist/amplience-sdk-client.js'
                    ],
                    'dist/videoJsResSwitcher.min.js': [
                      'bower_components/videojs/dist/alt/videojs.5.8.8.novtt.min.js',
                      'src/common/resSwitcher.min.js'
                      ]
                }
            }
        },

        cssmin: {
            options: {
                shorthandCompacting: false
            },
            target: {
                files: {
                    'dist/amp-dfs-viewer.min.css': [
                        'node_modules/amplience-sdk-client/dist/amplience-sdk-client.css',
                        'dist/amp-dfs-viewer.css'
                    ]
                }
            }
        },

        postcss: {
            options: {
                map: false,
                processors: [
                    require('autoprefixer')({
                        browsers: ['last 2 versions', 'ie >= 9']
                    })
                ]
            },
            build: {
                src: 'dist/amp-dfs-viewer.css'
            }
        },

        uglify: {
            build: {
                files: [
                    {
                        src: 'dist/amp-dfs-viewer-libs.js',
                        dest: 'dist/amp-dfs-viewer-libs.min.js'
                    }
                ]
            }

        },

        copy: {
            build: {
                files: [
                    {expand: true, cwd: 'assets/', src: ['**'], dest: 'dist/assets/'},
                    {
                        expand: true,
                        cwd: 'node_modules/amplience-sdk-client/dist/assets/image/',
                        src: ['spacer.gif'],
                        dest: 'dist/assets/image/'
                    },
                    {
                        expand: true,
                        cwd: 'node_modules/amplience-sdk-client/dist/assets/font/',
                        src: ['*'],
                        dest: 'dist/assets/font/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/videojs/dist/video-js/',
                        src: ['video-js.swf'],
                        dest: 'dist/assets/'
                    }
                ]
            },
            extractLibs: {
                files: [
                    {
                        expand: true,
                        cwd: 'node_modules/handlebars/dist/',
                        src: ['handlebars.runtime.min.js'],
                        dest: 'dist/'
                    },
                    {
                        expand: true,
                        cwd: 'bower_components/videojs/dist/alt',
                        src: ['video.novtt.js'],
                        dest: 'dist/'
                    },
                    {
                        expand: true,
                        cwd: 'src/common/',
                        src: ['resSwitcher.js'],
                        dest: 'dist/'
                    }
                ]
            }
        },

        clean: {
            distJs: ['dist/**/*.js', 'dist/**/*.map'],
            distCss: ['dist/assets/*', 'dist/**/*.css']
        },
        compress: {
            build: {
                options: {
                    mode: 'gzip'
                },
                files: [
                    {expand: true, src: ['dist/amp-dfs-viewer-libs.min.js'], dest: '', ext: '.min.js.gz'},
                    {expand: true, src: ['dist/amp-dfs-viewers.min.js'], dest: '', ext: '.min.js.gz'},
                    {expand: true, src: ['dist/amp-dfs-viewer.min.css'], dest: '', ext: '.min.css.gz'}
                ]
            }
        }

    });

    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-handlebars');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-file-append');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-postcss');
    grunt.loadNpmTasks('grunt-jscs');
    grunt.loadNpmTasks('grunt-contrib-compress');

    grunt.registerTask('build-js', [
        'clean:distJs',
        'concat:build',
        'handlebars:build',
        'file_append:commonJs',
        'browserify',
        'uglify:build',
        'copy:extractLibs'
    ]);

    grunt.registerTask('build-css', [
        'clean:distCss',
        'less:build',
        'less:buildVideo',
        'cssmin',
        'copy:build'
    ]);

    grunt.registerTask('build', [
        'build-js',
        'build-css'
        //Uncomment if gzip is needed
        //'compress:build'
    ]);

    grunt.registerTask('code-quality', [
        'jshint',
        'jscs:check'
    ]);

    grunt.registerTask('default', [
        'build',
        'connect:serve',
        'watch'
    ]);
};
