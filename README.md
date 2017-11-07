#Getting Started

##Installation and Build

### Install DFS viewer dependencies

from the folder where you cloned this repository run the following:

`npm install`

`bower up`

*NOTE: `npm install` for this project will install all dependencies of the Standard PDP Viewer and will also install and build the Fullscreen PDP Viewer via a `postinstall` command in the `package.json`*

### Building

If you just want to build the viewer, you can run `grunt build`, or if you want to build and develop the viewer run `grunt` which will run the default task (to build, serve via connect and watch for changes).

### Script Revisioning

Built scripts are prepended with a revision comment which contains the repo name, tags, the git commit SHA and whether it was built from a dirty source.  This makes it a bit easier to identify what you're looking at in the wild.

## Code Conventions

Umm, clean? ;)  These are enforced by running `grunt code-quality`

If you encounter jshint errors, fix them and run again... But if you encounter JSCS errors (which enforce good readability by common formatting conventions) you can get past a lot of them using automatic fixing by running `grunt jscs:fix`

### JavaScript

Please apply [Google JavaScript](https://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml) conventions.  To check that things are all good, run `grunt jshint` and `grunt jscs:check` regularly and ensure your editor is using the `.editorconfig` file or similar formatting enforcement.

### LESS / CSS

Split things into files as much as possible, consider the relevance of that rule inside that file.  For example, a rule that concerns itself with how elements are laid out on the page could belong in `_layout.less`

Use variables, direct colors and sizes in rules should be minimized and treated as a code smell.

Put all variables into a `_variables.less` file
# amp-viewer
