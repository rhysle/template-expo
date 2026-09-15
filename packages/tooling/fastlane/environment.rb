module RhysleEnvironment
  SHARED_KEYS = %w[APP_STORE_CONNECT_API_KEY_KEY_ID APP_STORE_CONNECT_API_KEY_ISSUER_ID APP_STORE_CONNECT_API_KEY_KEY_FILEPATH GOOGLE_PLAY_JSON_KEY_PATH APPLE_ID APPLE_TEAM_ID ITC_TEAM_ID].freeze
  APP_KEYS = %w[REVENUECAT_PROJECT_ID REVENUECAT_API_V2_KEY].freeze
  def self.required(key)
    value = ENV[key].to_s.strip
    raise "Missing #{key}. Add it to the appropriate .env.fastlane.local." if value.empty?
    value
  end
  def self.parse(source)
    source.lines.each_with_object({}) do |line, values|
      line = line.strip
      next if line.empty? || line.start_with?('#')
      match = /\A(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)\z/.match(line)
      raise 'Invalid environment declaration' unless match
      value = match[2].strip
      if (value.start_with?('"') && value.end_with?('"')) || (value.start_with?("'") && value.end_with?("'"))
        value = value[1...-1]
      end
      values[match[1]] = value
    end
  end
  def self.load(app_root)
    app_root = File.realpath(app_root)
    repo_root = File.expand_path('../..', app_root)
    unless File.basename(File.dirname(app_root)) == 'apps' && File.file?(File.join(repo_root, 'pnpm-workspace.yaml')) && File.file?(File.join(app_root, 'app.json'))
      raise 'Select an app directory before running Fastlane'
    end
    sources = [[repo_root, SHARED_KEYS], [app_root, APP_KEYS]].map do |root, allowed|
      file = File.join(root, '.env.fastlane.local')
      values = File.file?(file) ? parse(File.read(file)) : {}
      values.each_key { |key| raise "#{key} is not allowed in #{file}" unless allowed.include?(key) }
      values
    end
    sources.each { |values| values.each { |key, value| ENV[key] = value unless ENV.key?(key) } }
    %w[APP_STORE_CONNECT_API_KEY_KEY_FILEPATH GOOGLE_PLAY_JSON_KEY_PATH].each do |key|
      value = ENV[key].to_s.strip
      ENV[key] = File.expand_path(value, repo_root) unless value.empty?
    end
    app_root
  end
end
