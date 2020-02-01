package ru.neyvan.hm.json_creater;

import java.io.Serializable;
import java.util.ArrayList;

public class Person implements Serializable{
        private String name;
        private int age;
        private ArrayList numbers;

        public void setName(String name) {
            this.name = name;
        }

        public void setAge(int age) {
            this.age = age;
        }

        public void setNumbers(ArrayList numbers) {
            this.numbers = numbers;
        }

    public String getName() {
        return name;
    }
    public int getAge() {
        return age;
    }
    public Person(String name, int age, ArrayList numbers){
        this.name = name;
        this.age = age;
        this.numbers = numbers;
    }
}