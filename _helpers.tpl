{{/*
VideoKit için genel Helm şablonları.
*/}}

{{/*
Chart için tam adı oluşturur.
Eğer `nameOverride` belirtilmişse, onu kullanır.
Aksi takdirde, chart adını ve release adını birleştirir.
*/}}
{{- define "videokit.fullname" -}}
{{- if .Values.nameOverride }}
{{- .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.name }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}