# hex to byte array JS syntax string
# INPUT = "".gsub(" ", '')
# output = "["
# INPUT.chars.each_slice(2) do |pair|
#   output << "\"#{pair.join.to_i(16).to_s}\","
# end
# puts "#{output[0...-1]}]"

# RLE encode byte array
# INPUT = []
# INPUT << "TERM" # terminate the algorithm cleanly
# output = "["
# current_val = INPUT.first
# current_count = 0
# INPUT.each do |val|
#   if current_val != val
#     if current_count == 1
#       output << "#{current_val},"
#     else
#       output << "[#{current_val},#{current_count}],"
#     end
#     current_val = val
#     current_count = 0
#   end
#   current_count += 1
# end
# puts "#{output[0...-1]}]"

# convert metadata into title -> code map
require 'csv'
map = {}
output = "TITLE_TO_CODE = {"
CSV.foreach("metadata.csv", headers: true) do |row|
  next if row['ROM Size'] =~ /M/
  map[row['Internal Title']&.gsub(' ', '')&.upcase] = row['Code']
end
output += map.map { |k, v| "\"#{k}\":\"#{v}\"" }.join(',')
output += '};'
puts output
