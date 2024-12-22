###-begin-wpdocker-completions-###
#
# yargs command completion script
#
# Installation: wpdocker completion zsh >> ~/.zshrc
#
_wpdocker_yargs_completions()
{
  local reply
  local si=$IFS
  IFS=$'
' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" wpdocker --get-yargs-completions "${words[@]}"))
  IFS=$si
  _describe 'values' reply
}
compdef _wpdocker_yargs_completions wpdocker
###-end-wpdocker-completions-###

###-begin-wpdocker-hosts-completions-###
#
# yargs command completion script
#
# Installation: wpdocker-hosts completion >> ~/.zshrc
#
_wpdocker-hosts_yargs_completions()
{
  local reply
  local si=$IFS
  IFS=$'
' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" wpdocker-hosts --get-yargs-completions "${words[@]}"))
  IFS=$si
  _describe 'values' reply
}
compdef _wpdocker-hosts_yargs_completions wpdocker-hosts
###-end-wpdocker-hosts-completions-###
