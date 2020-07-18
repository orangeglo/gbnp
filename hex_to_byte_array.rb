INPUT = "".gsub(" ", '').freeze

output = "["
INPUT.chars.each_slice(2) do |pair|
  output << "\"#{pair.join.to_i(16).to_s}\","
end
puts "#{output[0...-1]}]"