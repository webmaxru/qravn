use std::collections::BTreeSet;

#[derive(Debug, Clone, Default)]
pub struct UnicodeReport {
    pub display: String,
    pub has_bidi_controls: bool,
    pub has_control_or_invisible: bool,
}

pub fn analyze_payload(raw: &str) -> UnicodeReport {
    let mut display = String::with_capacity(raw.len());
    let mut has_bidi_controls = false;
    let mut has_control_or_invisible = false;
    for ch in raw.chars() {
        if is_bidi_control(ch) {
            has_bidi_controls = true;
            display.push('\u{FFFD}');
        } else if is_control_or_invisible(ch) {
            has_control_or_invisible = true;
            display.push('\u{FFFD}');
        } else {
            display.push(ch);
        }
    }
    UnicodeReport {
        display,
        has_bidi_controls,
        has_control_or_invisible,
    }
}

pub fn is_bidi_control(ch: char) -> bool {
    matches!(
        ch as u32,
        0x202A..=0x202E | 0x2066..=0x2069 | 0x200E | 0x200F
    )
}

pub fn is_control_or_invisible(ch: char) -> bool {
    ch.is_control()
        || matches!(
            ch as u32,
            0x0000..=0x0008
                | 0x000B..=0x000C
                | 0x000E..=0x001F
                | 0x007F..=0x009F
                | 0x00AD
                | 0x034F
                | 0x061C
                | 0x180E
                | 0x200B..=0x200D
                | 0xFEFF
        )
}

pub fn scripts_for(s: &str) -> Vec<String> {
    let mut scripts = BTreeSet::new();
    for ch in s.chars().filter(|c| c.is_alphabetic()) {
        if ch.is_ascii_alphabetic() || matches!(ch, 'æ' | 'ø' | 'å' | 'Æ' | 'Ø' | 'Å') {
            scripts.insert("Latin".to_owned());
        } else if ('\u{0400}'..='\u{052F}').contains(&ch) {
            scripts.insert("Cyrillic".to_owned());
        } else if ('\u{0370}'..='\u{03FF}').contains(&ch) {
            scripts.insert("Greek".to_owned());
        } else if ('\u{0590}'..='\u{05FF}').contains(&ch) {
            scripts.insert("Hebrew".to_owned());
        } else if ('\u{0600}'..='\u{06FF}').contains(&ch) {
            scripts.insert("Arabic".to_owned());
        } else {
            scripts.insert("Other".to_owned());
        }
    }
    scripts.into_iter().collect()
}

pub fn skeleton(s: &str) -> String {
    s.chars()
        .map(confusable_char)
        .collect::<String>()
        .to_lowercase()
}

fn confusable_char(ch: char) -> char {
    match ch {
        'а' | 'Α' | 'А' | 'Ꭺ' | 'α' => 'a',
        'е' | 'Ε' | 'Е' | 'ｅ' => 'e',
        'о' | 'Ο' | 'О' => 'o',
        'р' | 'Ρ' | 'Р' => 'p',
        'с' | 'Ϲ' | 'С' => 'c',
        'у' | 'Υ' | 'У' => 'y',
        'х' | 'Χ' | 'Х' => 'x',
        'і' | 'Ι' | 'І' | 'Ӏ' => 'i',
        'ј' | 'Ј' => 'j',
        'ԁ' => 'd',
        'ɡ' => 'g',
        'ӏ' => 'l',
        'ᵐ' => 'm',
        'ո' => 'n',
        'ԛ' => 'q',
        'ѕ' | 'Ѕ' => 's',
        'ѵ' | 'ν' => 'v',
        _ => ch,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn neutralizes_bidi_and_controls() {
        let report = analyze_payload("abc\u{202E}\0def");
        assert!(report.has_bidi_controls);
        assert!(report.has_control_or_invisible);
        assert_eq!(report.display, "abc��def");
    }

    #[test]
    fn norwegian_latin_stays_latin() {
        assert_eq!(scripts_for("blåbær.no"), vec!["Latin"]);
    }
}
