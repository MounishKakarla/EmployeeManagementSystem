package com.employee.utils;
import java.security.SecureRandom;
import java.util.*;
public class GeneratePassword {
    private static final String UPPER="ABCDEFGHIJKLMNOPQRSTUVWXYZ",LOWER="abcdefghijklmnopqrstuvwxyz",
            DIGIT="0123456789",SPECIAL="@$!%*?&",ALL=UPPER+LOWER+DIGIT+SPECIAL;
    private static final SecureRandom random=new SecureRandom();
    public static String generatePassword(int length){
        if(length<8)throw new IllegalArgumentException("Min length 8");
        List<Character> pw=new ArrayList<>();
        pw.add(UPPER.charAt(random.nextInt(UPPER.length())));pw.add(LOWER.charAt(random.nextInt(LOWER.length())));
        pw.add(DIGIT.charAt(random.nextInt(DIGIT.length())));pw.add(SPECIAL.charAt(random.nextInt(SPECIAL.length())));
        for(int i=4;i<length;i++)pw.add(ALL.charAt(random.nextInt(ALL.length())));
        Collections.shuffle(pw);StringBuilder sb=new StringBuilder();for(char c:pw)sb.append(c);return sb.toString();
    }
}
