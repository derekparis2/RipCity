#!/usr/bin/env ruby

require "csv"

production_export_path, seed_sql_path = ARGV

unless production_export_path && seed_sql_path
  warn "Usage: ruby scripts/audit-exercise-seed.rb PRODUCTION_EXPORT SEED_SQL"
  exit 1
end

production_rows = CSV.read(production_export_path, headers: true)
production_by_name = production_rows.to_h { |row| [row.fetch("name"), row] }

sql_string = "'((?:''|[^'])*)'"
seed_row_pattern = Regexp.new(
  "^\\s*\\(#{([sql_string] * 6).join(',\\s*')}\\),?\\s*$"
)

seed_by_name = {}
File.foreach(seed_sql_path) do |line|
  match = seed_row_pattern.match(line)
  next unless match

  values = match.captures.map { |value| value.gsub("''", "'") }
  seed_by_name[values[0]] = {
    "category" => values[1],
    "equipment" => values[2],
    "movement_pattern" => values[3],
    "input_type" => values[4],
    "description" => values[5]
  }
end

extra_names = production_by_name.keys - seed_by_name.keys
missing_names = seed_by_name.keys - production_by_name.keys
compared_fields = %w[category equipment movement_pattern input_type description]
field_differences = []

(production_by_name.keys & seed_by_name.keys).sort.each do |name|
  compared_fields.each do |field|
    production_value = production_by_name.fetch(name).fetch(field)
    seed_value = seed_by_name.fetch(name).fetch(field)
    next if production_value == seed_value

    field_differences << [name, field, seed_value, production_value]
  end
end

puts "production_rows=#{production_rows.length}"
puts "seed_rows=#{seed_by_name.length}"
puts "extras=#{extra_names.length}"
extra_names.sort.each do |name|
  row = production_by_name.fetch(name)
  puts [
    "EXTRA",
    name,
    "has_creator=#{row.fetch('has_creator')}",
    "input_type=#{row.fetch('input_type')}",
    "category=#{row.fetch('category')}"
  ].join("|")
end

puts "missing=#{missing_names.length}"
missing_names.sort.each { |name| puts "MISSING|#{name}" }

puts "field_differences=#{field_differences.length}"
field_differences.each do |name, field, seed_value, production_value|
  puts ["DIFF", name, field, seed_value, production_value].join("|")
end
